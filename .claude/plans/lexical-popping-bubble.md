# Plan: Complete Stop/Cancel Campaign System

This plan implements a robust stop/cancel system for bulk messaging campaigns, ensuring immediate halt of sending loops and clear UI feedback.

## Context
The current system has a basic stop mechanism, but it's not fully integrated with the UI requirements, uses inconsistent naming, and lacks a dedicated "Cancel" status that properly disables further actions.

## Proposed Changes

### 1. Server-side Updates (`server.js`)

#### Rename/Add Route
- Add `POST /api/bulk/campaigns/:id/stop` (standardizing on the existing prefix or adding the specific one requested). The user requested `POST /stop-campaign/:id`. I will add this as an alias or primary route.

#### Update Sending Loop
- Ensure `campaign.stopRequested` check is robust.
- Break the loop and emit `bulk-campaign:stopped`.
- Update campaign status to `'stopped'` in the loop.

#### Route Logic
- Find campaign by ID.
- Set `stopRequested = true`.
- Set `status = 'stopped'`.
- Return success JSON.

### 2. Frontend Updates (`dashboard/index.html`)

#### UI Status Mapping
- Update `renderCampaigns` to handle `'stopped'` and `'cancelled'` statuses.
- Use `badge-danger` for stopped status.

#### Action Buttons
- Update logic to show Stop button only for `pending` or `processing` (or `active`).
- Add a red Stop button (square/cross icon).
- When clicked:
  - Optimistically update UI to `'STOPPED'`.
  - Disable controls.
  - Call the stop API.

#### Socket.io Listeners
- Add listener for `bulk-campaign:stopped` to sync UI state.

### 3. Verification Plan

#### Manual Testing
1. Start a bulk campaign with several contacts.
2. Observe messages being sent (logs).
3. Click the "Stop" button in the UI.
4. Verify:
   - UI status changes to "STOPPED".
   - Controls are disabled.
   - Server logs show "Campaign stopped by user".
   - No more messages are sent.
   - Refreshing the page still shows "STOPPED".

#### Edge Cases
- Stop already stopped campaign: API should return error or handle gracefully.
- Invalid ID: API should return 404.
- Stop completed campaign: API should return error.

## Critical Files
- `server.js`
- `dashboard/index.html`

## Reusable Utilities
- `showNotification(message, type)` in `dashboard/index.html`.
- `io.emit()` for real-time updates.
- `bulkCampaigns.find()` for locating campaigns.
