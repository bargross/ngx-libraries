import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxUpdaterNotifier } from './ngx-updater-notifier';

describe('NgxUpdaterNotifier', () => {
  let component: NgxUpdaterNotifier;
  let fixture: ComponentFixture<NgxUpdaterNotifier>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxUpdaterNotifier],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxUpdaterNotifier);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
