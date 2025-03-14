import React from 'react';
import { cn } from '@/lib/utils';

const Dialog = ({ open, onOpenChange, title, children, className }) => {
  if (!open) return null;

  const handleClose = () => {
    if (typeof onOpenChange === 'function') {
      onOpenChange(false);
    }
  };

  // Handle clicking outside the dialog to close it
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" 
      onClick={handleOverlayClick}
    >
      <div 
        className={cn("bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            <DialogClose onClick={handleClose}>Close</DialogClose>
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};

const DialogTrigger = ({ children, onClick }) => {
  return (
    <div onClick={onClick} className="cursor-pointer">
      {children}
    </div>
  );
};

const DialogContent = ({ children, className }) => {
  return <div className={cn("", className)}>{children}</div>;
};

const DialogHeader = ({ children, className }) => {
  return <div className={cn("mb-4", className)}>{children}</div>;
};

const DialogFooter = ({ children, className }) => {
  return (
    <div className={cn("mt-6 flex justify-end space-x-2", className)}>
      {children}
    </div>
  );
};

const DialogTitle = ({ children, className }) => {
  return <h3 className={cn("text-lg font-medium", className)}>{children}</h3>;
};

const DialogDescription = ({ children, className }) => {
  return <p className={cn("text-sm text-gray-500", className)}>{children}</p>;
};

const DialogClose = ({ children, className, onClick }) => {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onClick === 'function') {
      onClick(e);
    }
  };

  return (
    <button 
      onClick={handleClick} 
      className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background h-10 py-2 px-4 bg-primary text-primary-foreground hover:bg-primary/90", className)}
    >
      {children}
    </button>
  );
};

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
