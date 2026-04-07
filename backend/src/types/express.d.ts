declare namespace Express {
  interface User {
    id: string;
    email: string;
    name: string;
    isManager: boolean;
    isAdmin: boolean;
  }
}
