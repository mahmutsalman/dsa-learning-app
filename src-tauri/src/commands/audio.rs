use tauri::State;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::io::BufWriter;
use std::thread;
use std::sync::mpsc;
use base64::{Engine as _, engine::general_purpose};
use chrono::{Utc, Local};
use uuid::Uuid;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{WavWriter, WavSpec, SampleFormat};
use crate::models::*;
use std::collections::HashMap;

// Real audio recording system using cpal with thread-based stream management
// This solves the Send+Sync issues by keeping streams in a dedicated thread

// Audio recording states
#[derive(Debug, Clone, PartialEq)]
enum AudioStreamState {
    Recording,
    Paused,
    Stopped,
}

// Import AudioCommand from models to avoid circular dependency
use crate::models::AudioCommand;

// Response from the audio thread
#[derive(Debug)]
enum AudioResponse {
    Started,
    Stopped,
    Paused,
    Resumed,
    DevicesRefreshed(Vec<AudioDevice>),
    DeviceSwitched(String),
    Error(String),
}

// Global audio thread manager
static AUDIO_THREAD_INITIALIZED: std::sync::Once = std::sync::Once::new();

/// Initialize the audio recording thread
/// This creates a dedicated thread for audio operations to avoid Send+Sync issues
fn ensure_audio_thread_started(state: &AppState) -> Result<mpsc::Sender<AudioCommand>, String> {
    let sender_guard = state.audio_thread_sender.lock().map_err(|e| e.to_string())?;
    
    if let Some(ref sender) = *sender_guard {
        return Ok(sender.clone());
    }
    
    // Drop the guard before initializing
    drop(sender_guard);
    
    let (command_sender, command_receiver) = mpsc::channel::<AudioCommand>();
    let (response_sender, _response_receiver) = mpsc::channel::<AudioResponse>();
    
    // Spawn the audio recording thread
    thread::spawn(move || {
        audio_recording_thread(command_receiver, response_sender);
    });
    
    // Store the sender in the app state
    let mut sender_guard = state.audio_thread_sender.lock().map_err(|e| e.to_string())?;
    *sender_guard = Some(command_sender.clone());
    
    Ok(command_sender)
}

/// The dedicated audio recording thread with enhanced device management
/// This runs in its own thread to handle cpal streams without Send+Sync issues
fn audio_recording_thread(
    command_receiver: mpsc::Receiver<AudioCommand>,
    response_sender: mpsc::Sender<AudioResponse>,
) {
    let mut current_stream: Option<cpal::Stream> = None;
    let mut current_writer: Option<Arc<Mutex<Option<WavWriter<BufWriter<fs::File>>>>>> = None;
    let mut current_state: Option<Arc<Mutex<AudioStreamState>>> = None;
    
    // Enhanced device management
    let host = cpal::default_host();
    let mut available_devices: HashMap<String, cpal::Device> = HashMap::new();
    let mut current_device: Option<cpal::Device> = None;
    let mut current_device_name: String = String::new();
    
    // Initialize available devices
    if let Err(e) = refresh_available_devices(&host, &mut available_devices, &mut current_device, &mut current_device_name) {
        eprintln!("Failed to initialize audio devices: {}", e);
        let _ = response_sender.send(AudioResponse::Error(format!("Failed to initialize audio devices: {}", e)));
        return;
    }
    
    while let Ok(command) = command_receiver.recv() {
        match command {
            AudioCommand::StartRecording { filepath, sample_rate, channels } => {
                if let Some(ref device) = current_device {
                    match start_recording_stream(device, filepath.clone(), sample_rate, channels) {
                        Ok((stream, writer, state)) => {
                            current_stream = Some(stream);
                            current_writer = Some(writer);
                            current_state = Some(state);
                            let _ = response_sender.send(AudioResponse::Started);
                        }
                        Err(e) => {
                            // Try to refresh devices and retry once
                            if refresh_available_devices(&host, &mut available_devices, &mut current_device, &mut current_device_name).is_ok() {
                                if let Some(ref device) = current_device {
                                    match start_recording_stream(device, filepath.clone(), sample_rate, channels) {
                                        Ok((stream, writer, state)) => {
                                            current_stream = Some(stream);
                                            current_writer = Some(writer);
                                            current_state = Some(state);
                                            let _ = response_sender.send(AudioResponse::Started);
                                        }
                                        Err(retry_e) => {
                                            let _ = response_sender.send(AudioResponse::Error(format!("Audio start failed: {} (retry: {})", e, retry_e)));
                                        }
                                    }
                                } else {
                                    let _ = response_sender.send(AudioResponse::Error(format!("No audio device available after refresh: {}", e)));
                                }
                            } else {
                                let _ = response_sender.send(AudioResponse::Error(format!("Audio start failed: {}", e)));
                            }
                        }
                    }
                } else {
                    let _ = response_sender.send(AudioResponse::Error("No audio device available".to_string()));
                }
            }
            AudioCommand::StopRecording => {
                if let Some(stream) = current_stream.take() {
                    drop(stream); // This stops the stream
                }
                
                // Finalize the WAV file
                if let Some(writer_arc) = current_writer.take() {
                    if let Ok(mut writer_guard) = writer_arc.lock() {
                        if let Some(writer) = writer_guard.take() {
                            let _ = writer.finalize();
                        }
                    }
                }
                
                current_state = None;
                let _ = response_sender.send(AudioResponse::Stopped);
            }
            AudioCommand::PauseRecording => {
                if let Some(ref state_arc) = current_state {
                    if let Ok(mut state_guard) = state_arc.lock() {
                        *state_guard = AudioStreamState::Paused;
                    }
                }
                let _ = response_sender.send(AudioResponse::Paused);
            }
            AudioCommand::ResumeRecording => {
                if let Some(ref state_arc) = current_state {
                    if let Ok(mut state_guard) = state_arc.lock() {
                        *state_guard = AudioStreamState::Recording;
                    }
                }
                let _ = response_sender.send(AudioResponse::Resumed);
            }
            AudioCommand::RefreshDevices => {
                if let Err(e) = refresh_available_devices(&host, &mut available_devices, &mut current_device, &mut current_device_name) {
                    let _ = response_sender.send(AudioResponse::Error(format!("Failed to refresh devices: {}", e)));
                } else {
                    let device_list = create_device_list(&available_devices, &current_device_name);
                    let _ = response_sender.send(AudioResponse::DevicesRefreshed(device_list));
                }
            }
            AudioCommand::SwitchDevice { device_name } => {
                if let Some(device) = available_devices.get(&device_name) {
                    current_device = Some(device.clone());
                    current_device_name = device_name.clone();
                    let _ = response_sender.send(AudioResponse::DeviceSwitched(device_name));
                } else {
                    let _ = response_sender.send(AudioResponse::Error(format!("Device '{}' not found", device_name)));
                }
            }
        }
    }
}

/// Refresh the list of available audio input devices
fn refresh_available_devices(
    host: &cpal::Host,
    available_devices: &mut HashMap<String, cpal::Device>,
    current_device: &mut Option<cpal::Device>,
    current_device_name: &mut String,
) -> Result<(), String> {
    available_devices.clear();
    
    // Get all input devices
    let devices = host.input_devices()
        .map_err(|e| format!("Failed to enumerate input devices: {}", e))?;
    
    let default_device = host.default_input_device();
    let mut default_device_name = String::new();
    
    // Populate available devices
    for device in devices {
        let device_name = device.name()
            .unwrap_or_else(|_| "Unknown Device".to_string());
        
        // Check if this is the default device
        if let Some(ref default_dev) = default_device {
            if let (Ok(default_name), Ok(current_name)) = (default_dev.name(), device.name()) {
                if default_name == current_name {
                    default_device_name = device_name.clone();
                }
            }
        }
        
        available_devices.insert(device_name, device);
    }
    
    // If no current device is set, use the default
    if current_device.is_none() {
        if let Some(default_dev) = default_device {
            *current_device = Some(default_dev);
            *current_device_name = default_device_name;
        } else {
            return Err("No input devices available".to_string());
        }
    } else {
        // Verify current device is still available
        if !available_devices.contains_key(current_device_name) {
            // Current device is no longer available, switch to default
            if let Some(default_dev) = host.default_input_device() {
                *current_device = Some(default_dev);
                *current_device_name = default_device_name;
            } else {
                return Err("Current device unavailable and no default device found".to_string());
            }
        }
    }
    
    Ok(())
}

/// Create a list of audio devices for the frontend
fn create_device_list(available_devices: &HashMap<String, cpal::Device>, current_device_name: &str) -> Vec<AudioDevice> {
    let host = cpal::default_host();
    let default_device_name = host.default_input_device()
        .and_then(|device| device.name().ok())
        .unwrap_or_else(|| "Unknown".to_string());
    
    available_devices.iter()
        .map(|(name, _device)| AudioDevice {
            name: name.clone(),
            is_default: *name == default_device_name,
            is_current: *name == current_device_name,
        })
        .collect()
}

/// Create and start an audio recording stream with adaptive sample rate and mono configuration
fn start_recording_stream(
    device: &cpal::Device,
    filepath: String,
    _requested_sample_rate: u32,
    _requested_channels: u16,
) -> Result<(cpal::Stream, Arc<Mutex<Option<WavWriter<BufWriter<fs::File>>>>>, Arc<Mutex<AudioStreamState>>), String> {
    // Get the default input configuration from the device
    let config = device.default_input_config()
        .map_err(|e| format!("Failed to get default input config: {}", e))?;
    
    // Use device's native configuration to avoid silent streams on devices that don't support our overrides
    let device_sample_rate = config.sample_rate().0;
    let input_channels = config.channels() as u16;
    // We'll always write MONO to the WAV for simplicity and compatibility, downmixing if needed
    let target_channels = 1u16;
    
    println!("Device config: {:?}", config);
    println!("Using optimal settings - Sample Rate: {}Hz, Channels: {}, Device Native: {}Hz", 
             optimal_sample_rate, optimal_channels, device_sample_rate);
    
    // Create WAV file with optimal settings
    let file = fs::File::create(&filepath)
        .map_err(|e| format!("Failed to create audio file: {}", e))?;
    
    let spec = WavSpec {
        channels: target_channels,
        sample_rate: device_sample_rate,
        bits_per_sample: 16, // Standard 16-bit for voice (24-bit can cause compatibility issues)
        sample_format: SampleFormat::Int,
    };
    
    let writer = WavWriter::new(BufWriter::new(file), spec)
        .map_err(|e| format!("Failed to create WAV writer: {}", e))?;
    
    let writer_arc = Arc::new(Mutex::new(Some(writer)));
    let writer_clone = Arc::clone(&writer_arc);
    
    // Create shared state for pause/resume
    let state_arc = Arc::new(Mutex::new(AudioStreamState::Recording));
    
    // Create config that matches our target format for proper recording
    let stream_config = cpal::StreamConfig {
        channels: input_channels,
        sample_rate: cpal::SampleRate(device_sample_rate),
        buffer_size: cpal::BufferSize::Default,
    };
    
    // Create the audio stream based on sample format with proper resampling if needed
    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => {
            let state_clone_f32 = Arc::clone(&state_arc);
            let in_ch = input_channels as usize;
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Check if we're recording (not paused)
                    if let Ok(state_guard) = state_clone_f32.try_lock() {
                        if *state_guard == AudioStreamState::Recording {
                            if let Ok(mut writer_guard) = writer_clone.try_lock() {
                                if let Some(ref mut writer) = *writer_guard {
                                    if in_ch <= 1 {
                                        for &sample in data {
                                            let s = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                                            let _ = writer.write_sample(s);
                                        }
                                    } else {
                                        // Downmix interleaved multi-channel to mono by averaging
                                        let mut i = 0usize;
                                        while i + in_ch <= data.len() {
                                            let mut sum = 0.0f32;
                                            for c in 0..in_ch { sum += data[i + c]; }
                                            let avg = (sum / in_ch as f32).clamp(-1.0, 1.0);
                                            let s = (avg * i16::MAX as f32) as i16;
                                            let _ = writer.write_sample(s);
                                            i += in_ch;
                                        }
                                    }
                                }
                            }
                        }
                        // If paused, we simply skip writing but keep the stream alive
                    }
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
        }
        cpal::SampleFormat::I16 => {
            let writer_clone_i16 = Arc::clone(&writer_arc);
            let state_clone_i16 = Arc::clone(&state_arc);
            let in_ch = input_channels as usize;
            device.build_input_stream(
                &stream_config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    // Check if we're recording (not paused)
                    if let Ok(state_guard) = state_clone_i16.try_lock() {
                        if *state_guard == AudioStreamState::Recording {
                            if let Ok(mut writer_guard) = writer_clone_i16.try_lock() {
                                if let Some(ref mut writer) = *writer_guard {
                                    if in_ch <= 1 {
                                        for &sample in data {
                                            let _ = writer.write_sample(sample);
                                        }
                                    } else {
                                        let mut i = 0usize;
                                        while i + in_ch <= data.len() {
                                            let mut sum = 0i32;
                                            for c in 0..in_ch { sum += data[i + c] as i32; }
                                            let avg = (sum / in_ch as i32) as i16;
                                            let _ = writer.write_sample(avg);
                                            i += in_ch;
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
        }
        cpal::SampleFormat::U16 => {
            let writer_clone_u16 = Arc::clone(&writer_arc);
            let state_clone_u16 = Arc::clone(&state_arc);
            let in_ch = input_channels as usize;
            device.build_input_stream(
                &stream_config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    // Check if we're recording (not paused)
                    if let Ok(state_guard) = state_clone_u16.try_lock() {
                        if *state_guard == AudioStreamState::Recording {
                            if let Ok(mut writer_guard) = writer_clone_u16.try_lock() {
                                if let Some(ref mut writer) = *writer_guard {
                                    if in_ch <= 1 {
                                        for &sample in data {
                                            let sample_i16 = (sample as i32 - 32768) as i16;
                                            let _ = writer.write_sample(sample_i16);
                                        }
                                    } else {
                                        let mut i = 0usize;
                                        while i + in_ch <= data.len() {
                                            let mut sum = 0i32;
                                            for c in 0..in_ch {
                                                sum += (data[i + c] as i32 - 32768);
                                            }
                                            let avg = (sum / in_ch as i32) as i16;
                                            let _ = writer.write_sample(avg);
                                            i += in_ch;
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
        }
        _ => return Err("Unsupported sample format".to_string()),
    }.map_err(|e| format!("Failed to build input stream: {}", e))?;
    
    // Start the stream
    stream.play().map_err(|e| format!("Failed to start stream: {}", e))?;
    
    Ok((stream, writer_arc, state_arc))
}

/// Legacy fallback - will be removed once all functions use PathResolver
/// DO NOT USE - use state.path_resolver instead
#[deprecated(note = "Use state.path_resolver instead")]
fn get_app_data_dir() -> PathBuf {
    crate::path_resolver::get_app_data_dir_fallback()
}

#[tauri::command]
pub async fn start_recording(state: State<'_, AppState>, card_id: String) -> Result<RecordingInfo, String> {
    // Create recordings directory using the proper path resolver
    let recordings_dir = state.path_resolver.ensure_subdir("recordings")
        .map_err(|e| format!("Failed to create recordings directory: {}", e))?;
    
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    // Include card ID in filename to prevent conflicts between cards
    let card_prefix = &card_id[..8.min(card_id.len())]; // Use first 8 chars of card ID for brevity
    let filename = format!("recording_{}_{}.wav", card_prefix, timestamp);
    let filepath = recordings_dir.join(&filename);
    
    // Store recording session in AppState
    let recording_session = RecordingSession {
        id: Uuid::new_v4().to_string(),
        card_id: card_id.clone(),
        start_time: Utc::now(),
        is_paused: false,
        filename: filename.clone(),
        filepath: filepath.to_string_lossy().to_string(),
    };
    
    let mut recording_state = state.recording_state.lock().map_err(|e| e.to_string())?;
    *recording_state = Some(recording_session);
    
    // Start real audio recording
    let audio_sender = ensure_audio_thread_started(&state)?;
    
    // Send start recording command to audio thread with voice-optimized settings
    // Note: sample_rate and channels are now determined automatically by the device capabilities
    audio_sender.send(AudioCommand::StartRecording {
        filepath: filepath.to_string_lossy().to_string(),
        sample_rate: 44100, // Standard CD quality (will be auto-adjusted based on device)
        channels: 1, // Mono for voice recording (will be auto-adjusted for optimal quality)
    }).map_err(|e| format!("Failed to send start command to audio thread: {}", e))?;
    
    println!("Started real audio recording: {}", filepath.display());
    
    Ok(RecordingInfo {
        filename: filename.clone(),
        filepath: state.path_resolver.to_relative_path(&filepath),
    })
}

#[tauri::command]
pub async fn stop_recording(state: State<'_, AppState>, _card_id: String) -> Result<String, String> {
    // Get the recording session from AppState
    let mut recording_state = state.recording_state.lock().map_err(|e| e.to_string())?;
    let recording_session = recording_state.take().ok_or("No active recording")?;
    
    // Send stop command to audio thread
    let audio_sender_guard = state.audio_thread_sender.lock().map_err(|e| e.to_string())?;
    if let Some(ref audio_sender) = *audio_sender_guard {
        audio_sender.send(AudioCommand::StopRecording)
            .map_err(|e| format!("Failed to send stop command to audio thread: {}", e))?;
    }
    drop(audio_sender_guard);
    
    // Calculate actual duration
    let duration = (Utc::now() - recording_session.start_time).num_seconds() as i32;
    
    // Use recording session data and get proper relative path
    let recordings_dir = state.path_resolver.get_recordings_dir();
    let full_path = recordings_dir.join(&recording_session.filename);
    let relative_path = state.path_resolver.to_relative_path(&full_path);
    
    // Save recording to database
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let _recording = db.save_recording(&recording_session.card_id, &recording_session.filename, &relative_path, Some(duration))
        .map_err(|e| e.to_string())?;
    
    println!("Stopped audio recording, duration: {}s", duration);
    
    Ok("Recording saved successfully".to_string())
}

#[tauri::command]
pub async fn pause_recording(state: State<'_, AppState>) -> Result<String, String> {
    let recording_state = state.recording_state.lock().map_err(|e| e.to_string())?;
    
    if recording_state.is_some() {
        // Update the RecordingSession state
        let mut recording_state = state.recording_state.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut session) = *recording_state {
            session.is_paused = true;
        }
        drop(recording_state);
        
        // Send pause command to audio thread
        let audio_sender_guard = state.audio_thread_sender.lock().map_err(|e| e.to_string())?;
        if let Some(ref audio_sender) = *audio_sender_guard {
            audio_sender.send(AudioCommand::PauseRecording)
                .map_err(|e| format!("Failed to send pause command to audio thread: {}", e))?;
        }
        
        Ok("Recording paused".to_string())
    } else {
        Err("No active recording".to_string())
    }
}

#[tauri::command]
pub async fn resume_recording(state: State<'_, AppState>) -> Result<String, String> {
    let recording_state = state.recording_state.lock().map_err(|e| e.to_string())?;
    
    if recording_state.is_some() {
        // Update the RecordingSession state
        let mut recording_state = state.recording_state.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut session) = *recording_state {
            session.is_paused = false;
        }
        drop(recording_state);
        
        // Send resume command to audio thread
        let audio_sender_guard = state.audio_thread_sender.lock().map_err(|e| e.to_string())?;
        if let Some(ref audio_sender) = *audio_sender_guard {
            audio_sender.send(AudioCommand::ResumeRecording)
                .map_err(|e| format!("Failed to send resume command to audio thread: {}", e))?;
        }
        
        Ok("Recording resumed".to_string())
    } else {
        Err("No active recording".to_string())
    }
}

#[tauri::command]
pub async fn get_recording_state(state: State<'_, AppState>) -> Result<RecordingState, String> {
    let recording_state = state.recording_state.lock().map_err(|e| e.to_string())?;
    
    if let Some(ref session) = *recording_state {
        let elapsed_time = (Utc::now() - session.start_time).num_seconds() as i32;
        
        Ok(RecordingState {
            is_recording: true,
            is_paused: session.is_paused,
            current_recording_id: Some(session.id.clone()),
            recording_start_time: Some(session.start_time),
            elapsed_recording_time: elapsed_time,
        })
    } else {
        Ok(RecordingState {
            is_recording: false,
            is_paused: false,
            current_recording_id: None,
            recording_start_time: None,
            elapsed_recording_time: 0,
        })
    }
}

#[tauri::command]
pub async fn get_all_recordings(state: State<'_, AppState>) -> Result<Vec<Recording>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_recordings().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_card_recordings(state: State<'_, AppState>, card_id: String) -> Result<Vec<Recording>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_recordings_for_card(&card_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_audio_data(state: State<'_, AppState>, filepath: String) -> Result<String, String> {
    // Use the proper path resolver to convert relative path to absolute path
    let absolute_path = state.path_resolver.resolve_relative_path(&filepath);
    
    // Read the audio file
    let audio_data = fs::read(&absolute_path)
        .map_err(|e| format!("Failed to read audio file '{}': {}", absolute_path.display(), e))?;
    
    // Convert to base64 data URL
    let base64_data = general_purpose::STANDARD.encode(&audio_data);
    let data_url = format!("data:audio/wav;base64,{}", base64_data);
    
    Ok(data_url)
}

#[tauri::command]
pub async fn get_current_dir() -> Result<String, String> {
    let current_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    Ok(current_dir.to_string_lossy().to_string())
}


#[tauri::command]
pub async fn delete_recording(state: State<'_, AppState>, recording_id: String) -> Result<String, String> {
    // First, get the recording details from database to get the filepath
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let recording = {
        let recordings = db.get_recordings().map_err(|e| e.to_string())?;
        recordings.into_iter().find(|r| r.id == recording_id)
            .ok_or("Recording not found")?
    };
    drop(db);
    
    // Convert relative path to absolute path for file deletion using proper path resolver
    let file_path = state.path_resolver.resolve_relative_path(&recording.filepath);
    
    // Attempt to delete the physical file (don't fail if file doesn't exist)
    let file_deleted = match fs::remove_file(&file_path) {
        Ok(()) => {
            println!("Successfully deleted audio file: {}", file_path.display());
            true
        }
        Err(e) => {
            println!("Warning: Failed to delete audio file {}: {}. Continuing with database deletion.", file_path.display(), e);
            false
        }
    };
    
    // Delete from database
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_recording(&recording_id).map_err(|e| e.to_string())?;
    
    let message = if file_deleted {
        "Recording deleted successfully from database and file system"
    } else {
        "Recording deleted from database (file was already missing or inaccessible)"
    };
    
    Ok(message.to_string())
}

#[tauri::command]
pub async fn get_audio_devices(state: State<'_, AppState>) -> Result<AudioDeviceList, String> {
    let audio_sender = ensure_audio_thread_started(&state)?;
    
    // Send refresh command to get current device list
    audio_sender.send(AudioCommand::RefreshDevices)
        .map_err(|e| format!("Failed to send refresh devices command: {}", e))?;
    
    // For now, we'll return a basic device list since we can't easily get the response back
    // In a more complex implementation, we'd use a synchronous channel or callback system
    let host = cpal::default_host();
    let mut devices = Vec::new();
    let default_device_name = host.default_input_device()
        .and_then(|device| device.name().ok())
        .unwrap_or_else(|| "Unknown".to_string());
    
    if let Ok(input_devices) = host.input_devices() {
        for device in input_devices {
            if let Ok(name) = device.name() {
                devices.push(AudioDevice {
                    name: name.clone(),
                    is_default: name == default_device_name,
                    is_current: name == default_device_name, // Assume default is current initially
                });
            }
        }
    }
    
    Ok(AudioDeviceList {
        devices,
        current_device: Some(default_device_name),
    })
}

#[tauri::command]
pub async fn switch_audio_device(state: State<'_, AppState>, device_name: String) -> Result<String, String> {
    let audio_sender = ensure_audio_thread_started(&state)?;
    
    // Send switch device command to audio thread
    audio_sender.send(AudioCommand::SwitchDevice { device_name: device_name.clone() })
        .map_err(|e| format!("Failed to send switch device command: {}", e))?;
    
    Ok(format!("Switched to device: {}", device_name))
}

#[tauri::command]
pub async fn refresh_audio_devices(state: State<'_, AppState>) -> Result<AudioDeviceList, String> {
    // This is essentially the same as get_audio_devices but explicitly refreshes
    get_audio_devices(state).await
}
