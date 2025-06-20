# PlaylistPort User Stories

## Core User Stories

### 1. Playlist Submission
**As a user**, I want to submit Apple Music playlist URLs for YouTube Music conversion so that I can enjoy my playlists on a different platform.

**Acceptance Criteria:**
- User can submit Apple Music playlist URLs
- System limits conversion to 100 tracks maximum
- System truncates playlists exceeding 100 tracks
- System displays warning: "This playlist exceeds 100 tracks. Only the first 100 songs will be converted."

### 2. Progress Tracking
**As a user**, I want to see real-time conversion progress so that I know the status of my playlist conversion.

**Acceptance Criteria:**
- Real-time conversion tracking is displayed
- System performs parallel song matching
- Visual indicators show track status:
  - Grayed-out unavailable tracks (50% opacity, dashed border)
  - "Unavailable" status label
  - Progress states with color coding:
    - Queued: Blue
    - In Progress: Yellow
    - Completed: Green
    - Unavailable: Gray

### 3. Partial Conversion Results
**As a user**, I want to receive a YouTube Music playlist link even if not all tracks are converted so that I can still access the available songs.

**Acceptance Criteria:**
- System generates YouTube Music playlist link for partial conversions
- System displays conversion summary (e.g., "15/20 tracks converted. Unavailable tracks are grayed out.")
- Partial success is supported and communicated clearly

## Error Handling

### 4. Unavailable Track Handling
**As a user**, I want to understand why certain tracks are unavailable so that I know what to expect from the conversion.

**Acceptance Criteria:**
- Tooltip explains track unavailability
- Unavailability reasons include:
  - Region restrictions
  - Missing metadata
  - No YouTube Music API match
  - Region-locked content

### 5. API Rate Limiting
**As a user**, I want to be notified when the service is experiencing high demand so that I know when to try again.

**Acceptance Criteria:**
- User receives notification for high demand situations
- System displays warning: "High demand. Please try again in 5 minutes."

## Technical Constraints

- Maximum 100 tracks per playlist conversion
- Parallel track matching for efficiency
- Track unavailability determined by YouTube Music API match status and region restrictions

## Non-Goals

The following features are explicitly NOT included in this project scope:
- User account integration
- Post-conversion track editing capabilities
- Conversion history saving
- Playlist management beyond conversion