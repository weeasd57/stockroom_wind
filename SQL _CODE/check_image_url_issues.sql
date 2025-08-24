-- ===================================================================
-- CHECK FOR IMAGE_URL COLUMN ISSUES
-- ===================================================================

-- 1. Check if image_url column exists and its properties
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'posts' 
AND column_name = 'image_url';

-- 2. Check for any triggers on posts table that might affect image_url
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'posts';

-- 3. Check for any constraints on image_url column
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'posts' 
AND kcu.column_name = 'image_url';

-- 4. Test direct insert with image_url
-- Replace 'YOUR_USER_ID' with an actual user ID from profiles table
INSERT INTO posts (
    user_id,
    content,
    image_url,
    symbol,
    company_name,
    country,
    exchange,
    currency,
    price,
    price_change_24h,
    previous_close,
    day_low,
    day_high,
    year_low,
    year_high,
    market_cap,
    strategy,
    created_at
) VALUES (
    (SELECT id FROM profiles LIMIT 1), -- Gets first user ID
    'Direct SQL test post with image',
    'https://test-direct-sql.com/image.jpg',
    'TEST',
    'Test Company',
    'USA',
    'TEST',
    'USD',
    100,
    0,
    100,
    99,
    101,
    50,
    150,
    1000000,
    'BUY',
    NOW()
)
RETURNING id, image_url;

-- 5. Verify the insert
SELECT id, content, image_url, created_at 
FROM posts 
WHERE content = 'Direct SQL test post with image'
ORDER BY created_at DESC
LIMIT 1;

-- 6. Check if there's a view that might be filtering out image_url
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND view_definition LIKE '%posts%';

-- 7. Check RLS policies that might affect image_url
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'posts';

-- 8. Check if image_url is being set to NULL by any default or rule
SELECT 
    r.rulename,
    r.definition
FROM pg_rules r
WHERE r.tablename = 'posts';

-- 9. Simple test to see current posts with image_url
SELECT 
    COUNT(*) as total_posts,
    COUNT(image_url) as posts_with_image_url,
    COUNT(*) - COUNT(image_url) as posts_without_image_url
FROM posts;

-- 10. Show last 5 posts to see their image_url values
SELECT 
    id,
    LEFT(content, 50) as content_preview,
    image_url,
    created_at
FROM posts
ORDER BY created_at DESC
LIMIT 5;
