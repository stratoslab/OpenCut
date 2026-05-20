-- RLS policies for all tables
-- These policies allow the intended operations while maintaining row-level security

-- Feedback: anyone can insert (no auth required for feedback submission)
CREATE POLICY "anyone can insert feedback" ON "feedback"
  FOR INSERT WITH CHECK (true);

-- Users: authenticated users can read their own data
CREATE POLICY "users can view own data" ON "users"
  FOR SELECT USING (auth.uid() = id);

-- Users: authenticated users can update their own data
CREATE POLICY "users can update own data" ON "users"
  FOR UPDATE USING (auth.uid() = id);

-- Sessions: authenticated users can read their own sessions
CREATE POLICY "sessions can view own sessions" ON "sessions"
  FOR SELECT USING (user_id = auth.uid());

-- Sessions: authenticated users can manage their own sessions
CREATE POLICY "sessions can manage own sessions" ON "sessions"
  FOR ALL USING (user_id = auth.uid());

-- Accounts: authenticated users can read their own accounts
CREATE POLICY "accounts can view own accounts" ON "accounts"
  FOR SELECT USING (user_id = auth.uid());

-- Accounts: authenticated users can manage their own accounts
CREATE POLICY "accounts can manage own accounts" ON "accounts"
  FOR ALL USING (user_id = auth.uid());

-- Verifications: authenticated users can manage their own verifications
CREATE POLICY "verifications can manage own verifications" ON "verifications"
  FOR ALL USING (identifier = auth.uid()::text);
