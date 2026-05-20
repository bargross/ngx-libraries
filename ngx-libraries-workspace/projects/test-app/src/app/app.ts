import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdateNotifierComponent } from 'ngx-update-notifier';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UpdateNotifierComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('test-app');
}
