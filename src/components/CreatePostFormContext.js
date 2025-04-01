import React, { createContext, useContext, useState } from 'react';

const CreatePostFormContext = createContext();

export const useCreatePostForm = () => {
  return useContext(CreatePostFormContext);
};

export const CreatePostFormProvider = ({ children }) => {
  const [formData, setFormData] = useState({});

  const updateFormData = (newData) => {
    setFormData((prevData) => ({
      ...prevData,
      ...newData,
    }));
  };

  const submitForm = async (formData) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Failed to create post');
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return (
    <CreatePostFormContext.Provider value={{ formData, updateFormData, submitForm }}>
      {children}
    </CreatePostFormContext.Provider>
  );
};
