import type { DamageType } from './types';

export interface DamageGuide {
  possible: string[];
  fixes: string[];
  ask: string;
}

export const DAMAGE_FIXES: Record<DamageType, DamageGuide> = {
  front_bumper: {
    possible: [
      'Bumper cover cracked, dented or scuffed',
      'Mounting clips or brackets bent',
      'Parking sensors may be affected',
    ],
    fixes: ['Replace or repair the bumper cover', 'Blend paint to match the body', 'Check sensors and brackets'],
    ask: 'Is the bumper OEM or aftermarket, and is paint blending included?',
  },
  headlamp: {
    possible: ['Lens cracked or moisture inside the housing', 'Housing or bracket broken', 'Bulb or LED module affected'],
    fixes: ['Replace the lamp unit', 'Seal and align the housing', 'Check the wiring and connectors'],
    ask: 'Is this a full lamp unit or just the lens, and is alignment included?',
  },
  windscreen: {
    possible: ['Chip or crack in the glass', 'ADAS camera may need recalibration', 'Seals may need replacing'],
    fixes: ['Replace the windscreen', 'Recalibrate the ADAS camera if fitted', 'Check the seals'],
    ask: 'Is camera recalibration included? A cheap quote often leaves it out.',
  },
  panel_dent: {
    possible: ['Dent in a door or body panel', 'Paint cracked around the dent', 'Trim or clips may be loose'],
    fixes: ['Panel beat and repaint', 'Blend paint into the adjacent panel', 'Check the trim and clips'],
    ask: 'Is paint blending on the next panel included?',
  },
  side_mirror: {
    possible: ['Mirror housing cracked', 'Glass or folding motor damaged', 'Indicator or wiring affected'],
    fixes: ['Replace the mirror assembly or housing', 'Check the folding motor', 'Test the indicator and wiring'],
    ask: 'Is this the full assembly with the motor, or the housing only?',
  },
  wheel_tyre: {
    possible: ['Tyre sidewall damage or bulge', 'Wheel rim bent', 'Alignment may be affected'],
    fixes: ['Replace the tyre', 'Inspect and straighten the rim', 'Check the alignment'],
    ask: 'Is a wheel alignment included after fitting?',
  },
};
