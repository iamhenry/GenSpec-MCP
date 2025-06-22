### **Core User Stories**

1. **Playlist Submission (with Size Limit)**
   *As a user, I want to submit an Apple Music playlist URL so I can convert it to a YouTube Music playlist, even if it exceeds 100 tracks.*
   - **Acceptance Criteria**:
     - Only accepts playlists with ≤100 tracks.
     - Truncates playlists >100 tracks and shows a warning:
       *"This playlist exceeds 100 tracks. Only the first 100 songs will be converted."*
     - Disables submission for invalid URLs (non-Apple Music links).

2. **Progress Tracking (Partial Conversions with Parallel Matching)**
   *As a user, I want to see all tracks in the original playlist during conversion process with parallel song matching, so I can save time and know which songs were successfully matched.*
   - **Acceptance Criteria**:
     - Shows all 100 tracks (or original count if <100).
     - **Processes multiple tracks simultaneously (parallel matching) rather than one-by-one to reduce total conversion time.**
     - Unavailable tracks (unmatched or region-locked) are displayed with:
       - Grayed-out/ghosted appearance.
       - "Unavailable" status label.
     - Available tracks show progress indicators (queued, in progress, completed).
     - Progress updates in real-time as parallel matches complete.

3. **Result Display with Partial Success**
   *As a user, I want to receive a YouTube Music playlist link even if some tracks are missing, so I can access the partial conversion.*
   - **Acceptance Criteria**:
     - Shows the YouTube Music playlist link even if some tracks are unavailable.
     - Includes a note:
       *"15/20 tracks converted. Unavailable tracks are grayed out."*

---

### **Error Handling Stories**

4. **Unavailable Track Handling**
   *As a user, I want to see why a track is unavailable (e.g., region restrictions or missing metadata) to understand conversion limitations.*
   - **Acceptance Criteria**:
     - Grayed-out tracks show tooltip on hover:
       *"This track is unavailable due to region restrictions or missing metadata."*

5. **API Rate Limiting**
   *As a user, I want to be notified if the service is temporarily unavailable due to high demand.*
   - **Acceptance Criteria**:
     - Shows a warning:
       *"High demand. Please try again in 5 minutes."*

---

### **Non-Goals**
- User account integration (playlists are owned by the app's service account).
- Editing unavailable tracks post-conversion.
- Saving conversion history.

---

### **Visual Design Notes**
- **Grayed-out tracks**: Use 50% opacity and a dashed border.
- **Status labels**: "Queued" (blue), "In Progress" (yellow), "Completed" (green), "Unavailable" (gray).
- **Parallel processing indicator**: Show multiple tracks with "In Progress" status simultaneously.

---

### **Technical Constraints**
- Maximum playlist size: 100 tracks.
- Unavailable tracks are determined by:
  - No match in YouTube Music's API.
  - Region-locked content (based on the app's server region).
- **Parallel matching**: Process multiple tracks concurrently to optimize conversion speed, respecting API rate limits.