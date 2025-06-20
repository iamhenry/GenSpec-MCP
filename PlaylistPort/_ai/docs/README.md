# PlaylistPort

## Overview
PlaylistPort is a web application that converts Apple Music playlists to YouTube Music playlists. Users can submit Apple Music playlist URLs and receive corresponding YouTube Music playlist links, enabling seamless playlist migration between platforms.

## Features
- **Playlist URL Conversion**: Convert Apple Music playlist URLs to YouTube Music playlists
- **100-Track Limit**: Automatically handles playlists with up to 100 tracks
- **Real-Time Progress Tracking**: Visual progress indicators with status updates
- **Parallel Processing**: Efficient parallel song matching for faster conversions
- **Partial Conversion Support**: Generate playlists even when some tracks are unavailable
- **Error Handling**: Comprehensive handling of unavailable tracks and rate limiting
- **Visual Status Indicators**: Color-coded progress states and unavailable track highlighting

## System Requirements
- Modern web browser with JavaScript enabled
- Internet connection for API access
- Access to Apple Music and YouTube Music services

## Dependencies
- YouTube Music API for track matching and playlist creation
- Apple Music API for playlist parsing
- Web framework for user interface
- HTTP client for API requests

## Architecture
- **Frontend**: Web-based user interface for playlist submission and progress tracking
- **Backend**: API service handling playlist conversion logic
- **External APIs**: Integration with Apple Music and YouTube Music services
- **Processing Engine**: Parallel track matching and conversion system

## Core Components

### Playlist Submission Handler
- Accepts Apple Music playlist URLs
- Validates input and enforces 100-track limit
- Displays warnings for oversized playlists

### Conversion Engine
- Performs parallel track matching between platforms
- Handles partial conversions gracefully
- Manages API rate limiting and error states

### Progress Tracking System
- Real-time status updates with visual indicators
- Color-coded progress states (Queued, In Progress, Completed, Unavailable)
- Track availability status with explanatory tooltips

### Error Management
- Unavailable track handling with user feedback
- API rate limiting notifications
- Regional restriction and metadata issue management

## Usage
1. Submit an Apple Music playlist URL
2. Monitor real-time conversion progress
3. Receive YouTube Music playlist link upon completion
4. Access converted playlist with available tracks highlighted

## Limitations
- Maximum 100 tracks per playlist conversion
- No user account integration
- No post-conversion editing capabilities
- No conversion history storage