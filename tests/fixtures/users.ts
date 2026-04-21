import { Role } from '../utils/config.js';

export type TestUserRef = {
  role: Role;
  username: string;
  full_name: string;
  email: string;
};

export const TEST_USERS: TestUserRef[] = [
  { role: 'owner',      username: 'admin',          full_name: 'System Admin',   email: 'admin@test.local' },
  { role: 'manager',    username: 'test_manager',    full_name: 'Test Manager',    email: 'test_manager@test.local' },
  { role: 'accountant', username: 'test_accountant', full_name: 'Test Accountant', email: 'test_accountant@test.local' },
  { role: 'operator',   username: 'test_operator',   full_name: 'Test Operator',   email: 'test_operator@test.local' },
  { role: 'viewer',     username: 'test_viewer',     full_name: 'Test Viewer',     email: 'test_viewer@test.local' },
];
