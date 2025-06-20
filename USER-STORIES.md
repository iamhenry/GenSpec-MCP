# PlaylistPort User Stories

## Core User Stories

### 1. Playlist Submission
- **As a user**, I want to submit an Apple Music playlist URL so that it can be converted to YouTube Music
- **Given** I have an Apple Music playlist URL
- **When** I submit it for conversion
- **Then** the system should process up to 100 tracks
- **And** if the playlist has more than 100 tracks, it should truncate and show a warning

### 2. Progress Tracking
- **As a user**, I want to see real-time progress during conversion so that I know the status
- **Given** a playlist is being converted
- **When** the conversion process is running
- **Then** I should see all tracks being processed
- **And** track availability status should be displayed
- **And** progress should update in real-time with parallel song matching

### 3. Result Display
- **As a user**, I want to receive a YouTube Music playlist link after conversion
- **Given** the conversion process is complete
- **When** I view the results
- **Then** I should get a YouTube Music playlist link
- **And** see the conversion completion percentage
- **And** be able to access the playlist even if it's a partial conversion

## Error Handling Stories

### 4. Unavailable Track Handling
- **As a user**, I want to understand why certain tracks couldn't be converted
- **Given** some tracks are unavailable on YouTube Music
- **When** I view the conversion results
- **Then** I should see tooltips explaining unavailability reasons
- **And** understand if it's due to region restrictions or metadata issues

### 5. API Rate Limiting
- **As a user**, I want to be notified when the service is temporarily unavailable
- **Given** API rate limits are exceeded
- **When** I try to convert a playlist
- **Then** I should receive a clear notification about service unavailability
- **And** get guidance on when to retry

## Non-Goals

- No user account integration required
- No post-conversion track editing capabilities
- No conversion history saving functionality

## Technical Constraints

- Maximum 100 tracks per playlist conversion
- Track unavailability determined by:
  - No YouTube Music API match found
  - Region-locked content restrictions
- Parallel matching processing while respecting API rate limits