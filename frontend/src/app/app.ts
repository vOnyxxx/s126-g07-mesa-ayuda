import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MessageService } from 'primeng/api';
import { ApiService, Ticket, Usuario } from './services/api.service';

type Vista = 'login' | 'tickets' | 'detalle' | 'admin';

@Component({
  standalone: false,
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit {
  vista: Vista = 'login';
  modoRegistro = false;
  grupo = '';

  // Login / registro
  username = '';
  email = '';
  password = '';

  // Tickets
  tickets: Ticket[] = [];
  busqueda = '';
  nuevoTitulo = '';
  nuevaDescripcion = '';
  nuevaPrioridad = 'media';
  prioridades = ['baja', 'media', 'alta'];
  estados = ['abierto', 'en_progreso', 'cerrado'];

  // Detalle
  ticket: Ticket | null = null;
  descripcionHtml: SafeHtml = '';

  // Admin
  usuarios: Usuario[] = [];

  cargando = false;

  constructor(
    public api: ApiService,
    private messages: MessageService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.api.health().subscribe({
      next: (h) => (this.grupo = h.grupo),
      error: () => this.error('No se pudo conectar con el backend'),
    });
    if (this.api.autenticado) {
      this.irATickets();
    }
  }

  // ------------------------------------------------------------ Sesión

  enviarLogin(): void {
    this.cargando = true;
    this.api.login(this.username, this.password).subscribe({
      next: (res) => {
        this.api.guardarSesion(res, this.username);
        this.password = '';
        this.cargando = false;
        this.irATickets();
      },
      error: (e) => {
        this.cargando = false;
        this.error(e.error?.detail ?? 'Error al iniciar sesión');
      },
    });
  }

  enviarRegistro(): void {
    this.cargando = true;
    this.api.registro(this.username, this.email, this.password).subscribe({
      next: () => {
        this.cargando = false;
        this.modoRegistro = false;
        this.ok('Usuario creado. Ahora inicie sesión.');
      },
      error: (e) => {
        this.cargando = false;
        this.error(e.error?.detail ?? 'Error en el registro');
      },
    });
  }

  salir(): void {
    this.api.cerrarSesion();
    this.vista = 'login';
    this.tickets = [];
    this.usuarios = [];
  }

  // ------------------------------------------------------------ Tickets

  irATickets(): void {
    this.vista = 'tickets';
    this.api.misTickets().subscribe({
      next: (t) => (this.tickets = t),
      error: () => this.error('No se pudieron cargar los tickets'),
    });
  }

  buscar(): void {
    if (!this.busqueda.trim()) {
      this.irATickets();
      return;
    }
    this.api.buscar(this.busqueda).subscribe({
      next: (t) => (this.tickets = t),
      error: () => this.error('Error en la búsqueda'),
    });
  }

  crearTicket(): void {
    if (!this.nuevoTitulo.trim() || !this.nuevaDescripcion.trim()) {
      this.messages.add({ severity: 'warn', summary: 'Atención', detail: 'Complete título y descripción' });
      return;
    }
    this.api.crearTicket(this.nuevoTitulo, this.nuevaDescripcion, this.nuevaPrioridad).subscribe({
      next: () => {
        this.nuevoTitulo = '';
        this.nuevaDescripcion = '';
        this.nuevaPrioridad = 'media';
        this.ok('Ticket creado');
        this.irATickets();
      },
      error: () => this.error('No se pudo crear el ticket'),
    });
  }

  abrirTicket(id: number): void {
    this.api.verTicket(id).subscribe({
      next: (t) => {
        this.ticket = t;
        this.descripcionHtml = this.sanitizer.bypassSecurityTrustHtml(t.descripcion);
        this.vista = 'detalle';
      },
      error: () => this.error('Ticket no encontrado'),
    });
  }

  cambiarEstado(estado: string): void {
    if (!this.ticket) return;
    this.api.cambiarEstado(this.ticket.id, estado).subscribe({
      next: (t) => {
        this.ticket = t;
        this.ok(`Estado cambiado a ${estado}`);
      },
      error: () => this.error('No se pudo cambiar el estado'),
    });
  }

  severidad(prioridad: string): 'danger' | 'warn' | 'info' {
    return prioridad === 'alta' ? 'danger' : prioridad === 'media' ? 'warn' : 'info';
  }

  // ------------------------------------------------------------ Admin

  irAAdmin(): void {
    this.api.usuarios().subscribe({
      next: (u) => {
        this.usuarios = u;
        this.vista = 'admin';
      },
      error: () => this.error('Acceso denegado'),
    });
  }

  // ------------------------------------------------------------ Utilidades

  private ok(detail: string): void {
    this.messages.add({ severity: 'success', summary: 'Listo', detail });
  }

  private error(detail: string): void {
    this.messages.add({ severity: 'error', summary: 'Error', detail });
  }
}
