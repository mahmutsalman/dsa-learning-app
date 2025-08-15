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
enum AudioResponse {
    Started,
    Stopped,
    Paused,
    Resumed,
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

/// The dedicated audio recording thread
/// This runs in its own thread to handle cpal streams without Send+Sync issues
fn audio_recording_thread(
    command_receiver: mpsc::Receiver<AudioCommand>,
    response_sender: mpsc::Sender<AudioResponse>,
) {
    let mut current_stream: Option<cpal::Stream> = None;
    let mut current_writer: Option<Arc<Mutex<Option<WavWriter<BufWriter<fs::File>>>>>> = None;
    let mut current_state: Option<Arc<Mutex<AudioStreamState>>> = None;
    
    // Get the default host and device
    let host = cpal::default_host();
    let device = match host.default_input_device() {
        Some(device) => device,
        None => {
            eprintln!("No input device available");
            let _ = response_sender.send(AudioResponse::Error("No input device available".to_string()));
            return;
        }
    };
    
    while let Ok(command) = command_receiver.recv() {
        match command {
            AudioCommand::StartRecording { filepath, sample_rate, channels } => {
                match start_recording_stream(&device, filepath, sample_rate, channels) {
                    Ok((stream, writer, state)) => {
                        current_stream = Some(stream);
                        current_writer = Some(writer);
                        current_state = Some(state);
                        let _ = response_sender.send(AudioResponse::Started);
                    }
                    Err(e) => {
                        let _ = response_sender.send(AudioResponse::Error(e));
                    }
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
        }
    }
}

/// Create and start an audio recording stream
fn start_recording_stream(
    device: &cpal::Device,
    filepath: String,
    sample_rate: u32,
    channels: u16,
) -> Result<(cpal::Stream, Arc<Mutex<Option<WavWriter<BufWriter<fs::File>>>>>, Arc<Mutex<AudioStreamState>>), String> {
    // Create WAV file
    let file = fs::File::create(&filepath)
        .map_err(|e| format!("Failed to create audio file: {}", e))?;
    
    let spec = WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 24, // Improved bit depth for better audio quality
        sample_format: SampleFormat::Int,
    };
    
    let writer = WavWriter::new(BufWriter::new(file), spec)
        .map_err(|e| format!("Failed to create WAV writer: {}", e))?;
    
    let writer_arc = Arc::new(Mutex::new(Some(writer)));
    let writer_clone = Arc::clone(&writer_arc);
    
    // Create shared state for pause/resume
    let state_arc = Arc::new(Mutex::new(AudioStreamState::Recording));
    
    // Get the default input configuration
    let config = device.default_input_config()
        .map_err(|e| format!("Failed to get default input config: {}", e))?;
    
    println!("Input device config: {:?}", config);
    
    // Create the audio stream based on sample format
    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => {
            let state_clone_f32 = Arc::clone(&state_arc);
            device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Check if we're recording (not paused)
                    if let Ok(state_guard) = state_clone_f32.try_lock() {
                        if *state_guard == AudioStreamState::Recording {
                            if let Ok(mut writer_guard) = writer_clone.try_lock() {
                                if let Some(ref mut writer) = *writer_guard {
                                    for &sample in data {
                                        // Convert f32 sample to i32 for 24-bit recording with improved quality
                                        // Apply basic gain normalization to improve voice recording quality
                                        let normalized_sample = sample.clamp(-1.0, 1.0);
                                        let sample_i32 = (normalized_sample * ((1i32 << 23) - 1) as f32) as i32;
                                        let _ = writer.write_sample(sample_i32);
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
            device.build_input_stream(
                &config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    // Check if we're recording (not paused)
                    if let Ok(state_guard) = state_clone_i16.try_lock() {
                        if *state_guard == AudioStreamState::Recording {
                            if let Ok(mut writer_guard) = writer_clone_i16.try_lock() {
                                if let Some(ref mut writer) = *writer_guard {
                                    for &sample in data {
                                        // Convert i16 to i32 for 24-bit recording
                                        let sample_i32 = (sample as i32) << 8; // Scale up to 24-bit range
                                        let _ = writer.write_sample(sample_i32);
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
            device.build_input_stream(
                &config.into(),
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    // Check if we're recording (not paused)
                    if let Ok(state_guard) = state_clone_u16.try_lock() {
                        if *state_guard == AudioStreamState::Recording {
                            if let Ok(mut writer_guard) = writer_clone_u16.try_lock() {
                                if let Some(ref mut writer) = *writer_guard {
                                    for &sample in data {
                                        // Convert u16 to i32 for 24-bit recording
                                        let sample_i32 = (sample as i32 - 32768) << 8; // Convert to signed and scale to 24-bit
                                        let _ = writer.write_sample(sample_i32);
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
    
    // Send start recording command to audio thread with improved audio settings
    audio_sender.send(AudioCommand::StartRecording {
        filepath: filepath.to_string_lossy().to_string(),
        sample_rate: 48000, // Professional audio quality (48kHz)
        channels: 1, // Mono recording for voice (optimal for speech)
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