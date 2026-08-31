export interface SessionUser {
  uid: string;
  name: string;
  mail: string;
  roles: string[];
  csrfToken: string;
  logoutToken: string;
  accessToken: string;
  /** Cookie de sesión de Drupal (crudo del login) — para autenticar escrituras. */
  sessionCookie: string;
}
