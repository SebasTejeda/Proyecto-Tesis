
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: string;
}

export interface UserResponse {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  codigo_colegiatura?: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  picture?: string;
  created_at: string;
  google_id?: string;
}

export interface RegisterData {
  nombres: string;
  apellidos: string;
  email: string;
  password: string;
  codigo_colegiatura: string;
}
