import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth';

@Component({
  selector: 'app-pending-approval',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './pending-approval.component.html',
  styleUrls: ['./pending-approval.component.css']
})
export class PendingApprovalComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}