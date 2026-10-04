import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

const BASE_URL = 'http://localhost:8000';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  rol: string;
}

export interface Ticket {
  id: number;
  titulo: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  usuario_id: number;
  creado_en: string;
}

export interface Usuario {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  rol: string;
  creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
  }

  guardarSesion(res: LoginResponse, username: string): void {
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('rol', res.rol);
    localStorage.setItem('username', username);
    console.log('Sesión iniciada', username, res.access_token);
  }

  cerrarSesion(): void {
    localStorage.clear();
  }

  get autenticado(): boolean {
    return !!localStorage.getItem('token');
  }

  get rol(): string {
    return localStorage.getItem('rol') ?? '';
  }

  get username(): string {
    return localStorage.getItem('username') ?? '';
  }

  health(): Observable<{ estado: string; grupo: string; version: string }> {
    return this.http.get<{ estado: string; grupo: string; version: string }>(`${BASE_URL}/health`);
  }

  registro(username: string, email: string, password: string): Observable<unknown> {
    return this.http.post(`${BASE_URL}/auth/registro`, { username, email, password });
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${BASE_URL}/auth/login`, { username, password });
  }

  misTickets(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${BASE_URL}/tickets`, { headers: this.headers() });
  }

  buscar(q: string): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${BASE_URL}/tickets/buscar?q=${q}`, { headers: this.headers() });
  }

  verTicket(id: number): Observable<Ticket> {
    return this.http.get<Ticket>(`${BASE_URL}/tickets/${id}`, { headers: this.headers() });
  }

  crearTicket(titulo: string, descripcion: string, prioridad: string): Observable<Ticket> {
    return this.http.post<Ticket>(
      `${BASE_URL}/tickets`,
      { titulo, descripcion, prioridad },
      { headers: this.headers() }
    );
  }

  cambiarEstado(id: number, estado: string): Observable<Ticket> {
    return this.http.patch<Ticket>(
      `${BASE_URL}/tickets/${id}/estado`,
      { estado },
      { headers: this.headers() }
    );
  }

  usuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${BASE_URL}/admin/usuarios`, { headers: this.headers() });
  }
}
