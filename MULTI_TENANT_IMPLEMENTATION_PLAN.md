# Multi-Tenant SaaS Implementation Plan

## Critical Issues Identified

### 1. Database Schema Issues
- ❌ `business_config` table has no `user_id` column (single-tenant)
- ❌ No `payment_details` column for storing payment account info
- ❌ No `deal_tracker` table for logging confirmed deals
- ❌ `products` table has no `user_id` column (shared across all users)
- ❌ `product_media` table has no `user_id` column (shared across all users)

### 2. Backend Issues (server.js)
- ❌ Business config fetching uses hardcoded `id=1` (line 629-643)
- ❌ No userId filtering on database queries
- ❌ System prompt is hardcoded in server.js (lines 613-624)
- ❌ Deal detection doesn't save to database (lines 482-504)
- ❌ No dynamic fetching of business_instructions per user

### 3. Frontend Issues (dashboard.html)
- ❌ No save button functionality for business instructions
- ❌ No userId sent with business config updates
- ❌ Business instructions textarea not connected to API

## Implementation Steps

### Phase 1: Database Schema Update
1. Add `user_id` column to `business_config` table
2. Add `payment_details` column to `business_config` table
3. Create `deal_tracker` table with userId isolation
4. Add `user_id` to `products` and `product_media` tables
5. Update RLS policies for multi-tenant isolation

### Phase 2: Backend Fixes (server.js)
1. Update `/api/business-config` GET endpoint to filter by userId
2. Update `/api/business-config` POST endpoint to save with userId
3. Rewrite AI system prompt to act as Pakistani Salesman
4. Remove ALL hardcoded business logic from system prompt
5. Dynamically fetch business_instructions and payment_details per userId
6. Implement intent detection for deal confirmation
7. Create `/api/deals/track` endpoint to save deals to database

### Phase 3: Frontend Fixes (dashboard.html)
1. Add "Save Instructions" button to Business Instructions textarea
2. Connect button to `/api/business-config` POST endpoint with userId
3. Add payment details input field
4. Show success/error notifications on save
5. Load existing business instructions on page load

### Phase 4: AI Prompt Rewrite
1. Remove "You are a WhatsApp business assistant" 
2. Remove all hardcoded system instructions
3. Use ONLY user-provided business_instructions from database
4. Add minimal safety rules (no confirmation of orders/payments)
5. Mirror customer's language automatically
6. Only show payment details if present in database

## File Modifications Required

1. **NEW FILE**: `migration_multi_tenant.sql` - Database migration script
2. **EDIT**: `server.js` - Fix API endpoints and AI prompt logic
3. **EDIT**: `dashboard.html` - Add save functionality for business instructions
4. **NEW FILE**: `backend/services/dealTrackerService.js` - Deal tracking logic

## Expected Outcome

After implementation:
✅ Each user has isolated business_config (instructions + payment details)
✅ Business instructions save correctly from dashboard
✅ AI fetches user-specific config dynamically before each response
✅ AI sounds like a human Pakistani salesman (no AI artifacts)
✅ AI mirrors customer's language (Roman Urdu/English)
✅ Deal confirmation signals automatically save to deal_tracker table
✅ Complete data isolation between users (multi-tenant SaaS)

## Rollout Plan

1. Run database migration script
2. Deploy updated server.js
3. Deploy updated dashboard.html
4. Test with 2+ users to verify isolation
5. Monitor logs for AI prompt issues

---

**Ready to proceed with implementation?**
