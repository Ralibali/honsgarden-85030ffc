import React, { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import NewsletterSignup from '@/components/NewsletterSignup';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),insert:vi.fn(),success:vi.fn(),error:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:mocks.rpc,from:()=>({insert:mocks.insert})}}));
vi.mock('sonner',()=>({toast:{success:mocks.success,error:mocks.error}}));
beforeEach(()=>{vi.clearAllMocks();window.history.replaceState({},'', '/blogg');mocks.insert.mockResolvedValue({error:null});mocks.rpc.mockResolvedValue({data:true,error:null});});
afterEach(cleanup);
it('requests email confirmation without claiming subscription is confirmed',async()=>{
  render(<NewsletterSignup variant="inline"/>);
  fireEvent.change(screen.getByLabelText('E-postadress'),{target:{value:' Test@example.test '}});
  fireEvent.submit(screen.getByRole('form'));
  await screen.findByText('Bekräfta i din inkorg');
  expect(mocks.insert).toHaveBeenCalledWith({email:'test@example.test'});
  expect(screen.queryByText('Tack för din prenumeration!')).not.toBeInTheDocument();
});
it('consumes a fragment once across StrictMode and duplicate forms',async()=>{
  window.history.replaceState({},'', '/blogg#newsletter-confirm=test-token');
  render(<StrictMode><NewsletterSignup/><NewsletterSignup variant="inline"/></StrictMode>);
  await screen.findByText('Tack för din prenumeration!');
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('confirm_newsletter',{p_token:'test-token'});
  expect(window.location.hash).toBe('');
});
it('shows failure for an invalid/used confirmation link',async()=>{
  mocks.rpc.mockResolvedValue({data:false,error:null});
  window.history.replaceState({},'', '/blogg#newsletter-confirm=used-token');
  render(<NewsletterSignup/>);
  await waitFor(()=>expect(mocks.error).toHaveBeenCalled());
  expect(screen.queryByText('Tack för din prenumeration!')).not.toBeInTheDocument();
});
