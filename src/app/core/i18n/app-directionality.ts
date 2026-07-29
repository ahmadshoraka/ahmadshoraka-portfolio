import { EventEmitter, Injectable, signal } from '@angular/core';
import { Direction, Directionality } from '@angular/cdk/bidi';

@Injectable({ providedIn: 'root' })
export class AppDirectionality implements Directionality {
  readonly change = new EventEmitter<Direction>();
  readonly valueSignal = signal<Direction>('ltr');

  get value(): Direction {
    return this.valueSignal();
  }

  set value(dir: Direction) {
    this.valueSignal.set(dir);
    this.change.emit(dir);
  }

  ngOnDestroy(): void {
    this.change.complete();
  }
}
