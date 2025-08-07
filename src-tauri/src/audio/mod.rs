use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{WavSpec, WavWriter};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use std::fs::File;
use std::io::BufWriter;
use chrono::Utc;
use anyhow::{Context, Result};

#[derive(Debug, Clone, PartialEq)]
pub enum RecordingState {
    Recording,
    Paused,
    Stopped,
}

pub struct AudioRecorder {
    sample_rate: u32,
    channels: u16,
}

pub struct RecordingHandle {
    stream: cpal::Stream,
    writer: Arc<Mutex<Option<WavWriter<BufWriter<File>>>>>,
    state: Arc<Mutex<RecordingState>>,
    output_path: PathBuf,
    start_time: chrono::DateTime<Utc>,
}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            sample_rate: 48000,
            channels: 2,
        }
    }
    
    pub fn start_recording(&self, output_path: PathBuf) -> Result<RecordingHandle> {
        // Get default audio input device
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .context("No input device available")?;
        
        let supported_config = device
            .default_input_config()
            .context("Failed to get default input config")?;
        
        let config: cpal::StreamConfig = supported_config.clone().into();
        
        // Create WAV file with device's actual configuration
        let spec = WavSpec {
            channels: config.channels,
            sample_rate: config.sample_rate.0,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        
        let writer = WavWriter::create(&output_path, spec)
            .context("Failed to create WAV file")?;
        let writer = Arc::new(Mutex::new(Some(writer)));
        let writer_clone = writer.clone();
        
        // Shared state for pause/resume control
        let recording_state = Arc::new(Mutex::new(RecordingState::Recording));
        let state_clone = recording_state.clone();
        
        // Build audio input stream
        let stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &_| {
                // Only write when state is Recording (not Paused)
                if let Ok(state_guard) = state_clone.try_lock() {
                    if *state_guard == RecordingState::Recording {
                        if let Ok(mut guard) = writer_clone.try_lock() {
                            if let Some(ref mut writer) = *guard {
                                for &sample in data {
                                    let sample = (sample * i16::MAX as f32) as i16;
                                    let _ = writer.write_sample(sample);
                                }
                            }
                        }
                    }
                }
            },
            |err| eprintln!("Error in audio stream: {}", err),
            None,
        ).context("Failed to build input stream")?;
        
        stream.play().context("Failed to start audio stream")?;
        
        Ok(RecordingHandle {
            stream,
            writer,
            state: recording_state,
            output_path,
            start_time: Utc::now(),
        })
    }
}

impl RecordingHandle {
    pub fn pause(&self) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        *state = RecordingState::Paused;
        Ok(())
    }
    
    pub fn resume(&self) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        *state = RecordingState::Recording;
        Ok(())
    }
    
    pub fn stop(self) -> Result<PathBuf> {
        // Update state
        {
            let mut state = self.state.lock().unwrap();
            *state = RecordingState::Stopped;
        }
        
        // Stop the stream
        self.stream.pause().context("Failed to pause stream")?;
        
        // Finalize the WAV file
        {
            let mut writer_guard = self.writer.lock().unwrap();
            if let Some(writer) = writer_guard.take() {
                writer.finalize().context("Failed to finalize WAV file")?;
            }
        }
        
        Ok(self.output_path)
    }
    
    pub fn get_elapsed_time(&self) -> i32 {
        let now = Utc::now();
        (now - self.start_time).num_seconds() as i32
    }
    
    pub fn is_paused(&self) -> bool {
        if let Ok(state) = self.state.try_lock() {
            *state == RecordingState::Paused
        } else {
            false
        }
    }
    
    pub fn is_recording(&self) -> bool {
        if let Ok(state) = self.state.try_lock() {
            *state == RecordingState::Recording
        } else {
            false
        }
    }
}

// Utility functions
pub fn get_recordings_directory() -> Result<PathBuf> {
    let app_data_dir = std::env::current_dir()
        .context("Failed to get current directory")?
        .join("data")
        .join("recordings");
    
    std::fs::create_dir_all(&app_data_dir)
        .context("Failed to create recordings directory")?;
    
    Ok(app_data_dir)
}

pub fn generate_recording_filename() -> String {
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    format!("recording_{}.wav", timestamp)
}

pub fn get_audio_duration(filepath: &str) -> Result<i32> {
    let reader = hound::WavReader::open(filepath)
        .context("Failed to open audio file")?;
    
    let spec = reader.spec();
    let samples = reader.len();
    let duration_seconds = samples as f64 / (spec.sample_rate as f64 * spec.channels as f64);
    
    Ok(duration_seconds as i32)
}