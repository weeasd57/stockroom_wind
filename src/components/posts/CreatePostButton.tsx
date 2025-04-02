import { useCreatePostForm } from '@/providers/CreatePostFormProvider';
import styles from '@/styles/createPostButton.module.css';
import React from 'react';

interface CreatePostButtonProps {
  className?: string;
  inDialog?: boolean;
  iconOnly?: boolean;
  children?: React.ReactNode;
  fab?: boolean;
  size?: 'small' | 'default' | 'large';
}

export const CreatePostButton: React.FC<CreatePostButtonProps> = ({ 
  className, 
  inDialog, 
  iconOnly, 
  children, 
  fab, 
  size 
}) => {
  const { openDialog } = useCreatePostForm();

  const buttonClasses = [
    styles.createPostButton,
    inDialog ? styles.inDialog : '',
    iconOnly ? styles.iconOnly : '',
    fab ? styles.fab : '',
    size === 'small' ? styles.small : '',
    size === 'large' ? styles.large : '',
    className || ''
  ].filter(Boolean).join(' ');

  return (
    <button
      onClick={openDialog}
      className={buttonClasses}
    >
      {children || 'Create Post'}
    </button>
  );
};