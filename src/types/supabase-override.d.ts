// TypeScript declaration to override the problematic Supabase tsconfig issue
// This file provides type definitions that bypass the missing tsconfig/base.json error

declare module '@supabase/auth-helpers-nextjs' {
  export * from '@supabase/auth-helpers-nextjs/dist/index';
}

declare module '@supabase/auth-helpers-nextjs/*' {
  const content: any;
  export default content;
}

// Override the problematic tsconfig reference
declare const __SUPABASE_AUTH_HELPERS_TSCONFIG__: any;
