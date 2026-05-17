import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxUpdateNotifier } from './ngx-update-notifier';

describe('NgxUpdateNotifier', () => {
  let component: NgxUpdateNotifier;
  let fixture: ComponentFixture<NgxUpdateNotifier>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxUpdateNotifier],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxUpdateNotifier);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
