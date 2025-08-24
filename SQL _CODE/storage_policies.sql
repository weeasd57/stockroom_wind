-- ===================================================================
-- SUPABASE STORAGE POLICIES FOR POST IMAGES
-- ===================================================================

-- Create the post_images bucket if it doesn't exist
-- Note: This needs to be done via Supabase Dashboard or API, not SQL
-- Go to Storage section in Supabase Dashboard and create a bucket named 'post_images'

-- ===================================================================
-- STORAGE POLICIES FOR post_images BUCKET
-- ===================================================================
-- These policies need to be applied via Supabase Dashboard under Storage > Policies
-- Or via Supabase Management API

-- Policy 1: Allow authenticated users to upload images to their own folder
-- Name: Allow users to upload their own images
-- Operation: INSERT
-- Definition:
/*
bucket_id = 'post_images' 
AND auth.uid()::text = (storage.foldername(name))[1]
*/

-- Policy 2: Allow public read access to all images
-- Name: Public read access
-- Operation: SELECT
-- Definition:
/*
bucket_id = 'post_images'
*/

-- Policy 3: Allow users to update their own images
-- Name: Allow users to update their own images
-- Operation: UPDATE
-- Definition:
/*
bucket_id = 'post_images' 
AND auth.uid()::text = (storage.foldername(name))[1]
*/

-- Policy 4: Allow users to delete their own images
-- Name: Allow users to delete their own images
-- Operation: DELETE
-- Definition:
/*
bucket_id = 'post_images' 
AND auth.uid()::text = (storage.foldername(name))[1]
*/

-- ===================================================================
-- ALTERNATIVE: Simple policies for all authenticated users
-- ===================================================================
-- If the above policies are too restrictive, use these simpler ones:

-- Policy 1: Allow all authenticated users to upload
-- Name: Authenticated users can upload
-- Operation: INSERT
-- Definition:
/*
bucket_id = 'post_images' 
AND auth.role() = 'authenticated'
*/

-- Policy 2: Public read access
-- Name: Public read access
-- Operation: SELECT  
-- Definition:
/*
bucket_id = 'post_images'
*/

-- Policy 3: Allow authenticated users to update any image
-- Name: Authenticated users can update
-- Operation: UPDATE
-- Definition:
/*
bucket_id = 'post_images'
AND auth.role() = 'authenticated'
*/

-- Policy 4: Allow authenticated users to delete any image
-- Name: Authenticated users can delete
-- Operation: DELETE
-- Definition:
/*
bucket_id = 'post_images'
AND auth.role() = 'authenticated'
*/

-- ===================================================================
-- INSTRUCTIONS TO APPLY THESE POLICIES
-- ===================================================================
/*
1. Go to your Supabase Dashboard
2. Navigate to Storage section
3. Create a new bucket called 'post_images' if it doesn't exist
   - Set it as PUBLIC bucket for easier access
4. Click on the 'post_images' bucket
5. Go to Policies tab
6. Add the policies above using the "New Policy" button
7. For each policy:
   - Give it a descriptive name
   - Select the operation (INSERT, SELECT, UPDATE, or DELETE)
   - Choose "For custom policy" 
   - Enter the policy definition from above
   - Save the policy

Alternative via Supabase CLI:
You can also use the Supabase CLI to apply these policies programmatically.
*/

-- ===================================================================
-- VERIFY BUCKET EXISTS AND IS ACCESSIBLE
-- ===================================================================
-- Run this query in SQL Editor to check if you can access storage schema:
/*
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets
WHERE name = 'post_images';
*/

-- If the bucket doesn't exist, create it via Dashboard or use this API call:
/*
POST https://YOUR_PROJECT_URL/storage/v1/bucket
Headers:
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
Body:
{
  "id": "post_images",
  "name": "post_images",
  "public": true
}
*/
