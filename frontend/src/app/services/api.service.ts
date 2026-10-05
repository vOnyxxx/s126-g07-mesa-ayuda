import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

const BASE_URL = '/api';

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
  // El token de acceso vive SOLO en memoria (hallazgo 10, Parte 6): un
  // XSS que logre ejecutar JS puede leer localStorage/sessionStorage
  // completos, pero no una variable privada de esta instancia sin pasar
  // por esta misma clase. El costo es que la sesión no sobrevive a un
  // F5; para persistirla entre recargas sin este riesgo se necesitaría
  // un token de refresco en cookie httpOnly emitido por el backend, que
  // queda fuera del alcance de esta corrección.
  private token = '';
  // rol/username no son secretos (solo controlan qué ve la UI); se
  // guardan en sessionStorage para sobrevivir un F5 sin quedar en disco
  // ni compartirse entre pestañas de otra sesión.

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  guardarSesion(res: LoginResponse, username: string): void {
    this.token = res.access_token;
    sessionStorage.setItem('rol', res.rol);
    sessionStorage.setItem('username', username);
  }

  cerrarSesion(): void {
    this.token = '';
    sessionStorage.clear();
  }

  get autenticado(): boolean {
    return !!this.token;
  }

  get rol(): string {
    return sessionStorage.getItem('rol') ?? '';
  }

  get username(): string {
    return sessionStorage.getItem('username') ?? '';
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
    return this.http.get<Ticket[]>(
      `${BASE_URL}/tickets/buscar?q=${encodeURIComponent(q)}`,
      { headers: this.headers() }
    );
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
