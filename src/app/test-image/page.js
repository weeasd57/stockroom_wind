'use client';

import { useState } from 'react';

export default function TestImagePage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const testDirectInsert = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-image-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: 'https://test-image.com/test.jpg',
          user_id: null // Will use default test user
        })
      });
      
      const data = await response.json();
      console.log('Test result:', data);
      setResult(data);
    } catch (error) {
      console.error('Test failed:', error);
      setResult({ error: error.message });
    }
    setLoading(false);
  };

  const checkPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-image-upload');
      const data = await response.json();
      console.log('Posts check:', data);
      setResult(data);
    } catch (error) {
      console.error('Check failed:', error);
      setResult({ error: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Image Upload to Database</h1>
      
      <div className="space-y-4 mb-8">
        <button
          onClick={testDirectInsert}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 mr-4"
        >
          Test Direct Insert with image_url
        </button>
        
        <button
          onClick={checkPosts}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Check Recent Posts
        </button>
      </div>

      {loading && <div>Loading...</div>}
      
      {result && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">Result:</h2>
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-bold mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-2">
          <li>Open Console (F12) to see detailed logs</li>
          <li>Click "Test Direct Insert" to test inserting a post with image_url</li>
          <li>Check the result - it should show if image_url was saved</li>
          <li>Click "Check Recent Posts" to see recent posts and their image_urls</li>
          <li>If image_url is null, check Console for error messages</li>
        </ol>
      </div>
    </div>
  );
}
