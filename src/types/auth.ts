export interface SessionUser {
  uid: string;
  name: string;
  mail: string;
  roles: string[];
  csrfToken: string;
  logoutToken: string;
  accessToken: string;
}
