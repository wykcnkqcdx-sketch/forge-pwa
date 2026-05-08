export type Stretch = {
  name: string;
  duration: string;
  instruction: string;
};

export type RecoveryExercise = {
  name: string;
  sets: string;
  reps: string;
  notes: string;
};

export type InjuryProtocol = {
  region: string;
  muscles: string[];
  acuteManagement: string;
  modality: 'ice' | 'heat' | 'both' | 'rice';
  returnToTrainDays: { mild: number; moderate: number; severe: number };
  stretches: Stretch[];
  recoveryExercises: RecoveryExercise[];
  maintenanceExercises: string[];
  preventionTips: string[];
};

function getBand(id: string): number {
  const index = parseInt(id.slice(1), 10) - 1;
  const pair = Math.floor(index / 2);
  return Math.floor(pair / 3);
}

function getRegionKey(segmentId: string): string {
  const prefix = segmentId[0];
  const band = getBand(segmentId);
  if (prefix === 'A') {
    switch (band) {
      case 0: return 'head_neck_anterior';
      case 1: return 'chest_shoulder';
      case 2: return 'upper_abdomen_biceps';
      case 3: return 'lower_abdomen_forearm';
      case 4: return 'hip_groin';
      default: return 'quadriceps';
    }
  } else {
    switch (band) {
      case 0: return 'head_neck_posterior';
      case 1: return 'upper_back_shoulder';
      case 2: return 'mid_back_triceps';
      case 3: return 'lower_back';
      case 4: return 'glutes_hamstrings';
      case 5: return 'calf_achilles';
      default: return 'ankle_foot';
    }
  }
}

export function getProtocol(segmentId: string): InjuryProtocol {
  return protocols[getRegionKey(segmentId)] ?? protocols.general;
}

const protocols: Record<string, InjuryProtocol> = {
  head_neck_anterior: {
    region: 'Head & Anterior Neck',
    muscles: ['Sternocleidomastoid', 'Scalenes', 'Platysma', 'Suprahyoids'],
    acuteManagement: 'Rest. Ice 15 min/hour for 24h. Avoid loaded carries until pain-free. Refer immediately if neurological symptoms (tingling, arm weakness, dizziness) are present.',
    modality: 'ice',
    returnToTrainDays: { mild: 2, moderate: 5, severe: 14 },
    stretches: [
      { name: 'Cervical Rotation', duration: '30s each side', instruction: 'Slowly rotate chin toward shoulder, hold. Never force range of motion.' },
      { name: 'Cervical Lateral Flexion', duration: '30s each side', instruction: 'Tilt ear toward shoulder, gentle hand pressure from above. Stop at first resistance.' },
      { name: 'Chin Tuck', duration: '10 reps × 3s hold', instruction: 'Retract chin horizontally — create a "double chin." Corrects forward head posture.' },
    ],
    recoveryExercises: [
      { name: 'Isometric Neck Hold', sets: '3', reps: '10s × 5 directions', notes: 'Press head into hand in all planes — resist with hand, no movement.' },
      { name: 'Scapular Retraction', sets: '3', reps: '15', notes: 'Pinch shoulder blades together. Relieves SCM and upper trap compensatory tension.' },
    ],
    maintenanceExercises: ['Chin tucks 2×/day (10 reps)', 'Band pull-aparts 3×/week', 'Dead hangs 3 × 20–30s'],
    preventionTips: [
      'Fit ruck properly — pack rides high and tight on upper back, weight distributed across hips.',
      'Maintain chin-tuck posture during loaded marches — reduces cervical compressive load.',
      'Limit prolonged forward head posture (screens/phones) post-session while fatigued.',
    ],
  },

  head_neck_posterior: {
    region: 'Posterior Neck & Cervical Spine',
    muscles: ['Cervical erector spinae', 'Semispinalis capitis', 'Splenius capitis', 'Suboccipitals', 'Upper trapezius'],
    acuteManagement: 'Ice 15 min/hour for 24–48h. Avoid cervical loading and weighted carries. Red flags (bilateral arm symptoms, drop attacks) — immediate referral.',
    modality: 'ice',
    returnToTrainDays: { mild: 2, moderate: 5, severe: 14 },
    stretches: [
      { name: 'Suboccipital Release', duration: '60s', instruction: 'Hands laced behind skull, let head weight stretch base of skull. Eyes look toward floor.' },
      { name: 'Upper Trap Stretch', duration: '30s each side', instruction: 'Tilt ear to shoulder, apply gentle downward pressure on opposite shoulder.' },
      { name: 'Levator Scapulae Stretch', duration: '30s each side', instruction: 'Rotate chin 45° away from side being stretched, then look down into armpit.' },
    ],
    recoveryExercises: [
      { name: 'Deep Neck Flexor Activation', sets: '3', reps: '10 × 10s hold', notes: 'Chin tuck + gentle nod. Trains longus colli — the primary cervical spine stabiliser.' },
      { name: 'Cat-Cow (cervical emphasis)', sets: '3', reps: '10 slow', notes: 'Focus on neck flexion/extension component only. Pumps cervical facet joints.' },
    ],
    maintenanceExercises: ['Chin tucks daily', 'Dead hangs 3×/week', 'Face pulls with Y/W/T positions'],
    preventionTips: [
      'Adjust ruck head strap — excessive anterior head position from pack load increases suboccipital compression.',
      'Address thoracic kyphosis — stiff T-spine forces cervical compensation.',
      'Sleep posture: side or back, neutral cervical spine. Avoid stomach sleeping.',
    ],
  },

  chest_shoulder: {
    region: 'Chest & Anterior Shoulder',
    muscles: ['Pectoralis major', 'Pectoralis minor', 'Anterior deltoid', 'Coracobrachialis', 'Biceps long head (proximal)'],
    acuteManagement: 'Ice 20 min, 3×/day for 48h. Avoid overhead pressing and loaded push patterns. Sling if severe.',
    modality: 'ice',
    returnToTrainDays: { mild: 3, moderate: 7, severe: 21 },
    stretches: [
      { name: 'Doorway Pec Stretch', duration: '30s × 3', instruction: 'Arm at 90°, forearm against doorframe. Step through until stretch felt across front of shoulder. Do not force.' },
      { name: 'Sleeper Stretch', duration: '30s each side', instruction: 'Side-lie, shoulder at 90°. Use other hand to rotate forearm toward floor. Internal rotation stretch.' },
      { name: 'Cross-Body Shoulder Stretch', duration: '30s each side', instruction: 'Pull arm across chest at shoulder height, press with opposite hand. Targets posterior capsule.' },
    ],
    recoveryExercises: [
      { name: 'Band External Rotation', sets: '3', reps: '15', notes: 'Elbow at 90° by side. Rotate forearm outward against band. Strengthens posterior cuff.' },
      { name: 'Scapular Wall Slide', sets: '3', reps: '10', notes: 'Back against wall, arms slide up and down. Lower trap and serratus activation.' },
      { name: 'Pendulum Swings', sets: '2', reps: '30s circles each direction', notes: 'Passive glenohumeral distraction. Pain relief in acute phase.' },
    ],
    maintenanceExercises: ['Face pulls 3×/week', 'Rear delt fly 2×/week', 'Band external rotation daily warm-up'],
    preventionTips: [
      'Maintain push:pull ratio minimum 1:1.5 — for every pressing set, do more pulling.',
      'Warm up rotator cuff with band work before any heavy pressing session.',
      'Avoid sleeping on affected shoulder. Pillow between arm and body in side-lying position.',
    ],
  },

  upper_abdomen_biceps: {
    region: 'Upper Abdomen & Biceps',
    muscles: ['Rectus abdominis (upper)', 'External oblique', 'Biceps brachii', 'Brachialis', 'Brachioradialis'],
    acuteManagement: 'Ice biceps strains (48h). Heat for abdominal cramping post-exercise. Avoid heavy curls and loaded carries for 48h.',
    modality: 'both',
    returnToTrainDays: { mild: 2, moderate: 5, severe: 14 },
    stretches: [
      { name: 'Overhead Bicep Stretch', duration: '30s each side', instruction: 'Arm fully extended, externally rotate and reach back. Feel stretch through biceps into anterior shoulder.' },
      { name: 'Cobra Stretch', duration: '30s × 3', instruction: 'Prone, press up on hands, hips remain on floor. Stretches upper abdominal wall.' },
      { name: 'Standing Side Bend', duration: '20s each side', instruction: 'One arm overhead, lean laterally away. Stretches obliques and intercostals.' },
    ],
    recoveryExercises: [
      { name: 'Hammer Curl (light)', sets: '3', reps: '12', notes: 'Neutral grip reduces bicep stress. Works brachialis and brachioradialis.' },
      { name: 'Plank Hold', sets: '3', reps: '20–30s', notes: 'Isometric core with no spinal flexion. Safe during acute abdominal strain.' },
      { name: 'Dead Bug', sets: '3', reps: '8 each side', notes: 'Transverse abdominis activation in supine. Minimal rectus load.' },
    ],
    maintenanceExercises: ['Eccentric curls 1×/week (slow lower)', 'Hollow body hold 3×/week', 'Cable curl with 3s lowering'],
    preventionTips: [
      'Warm up pulling muscles (band curls, rope face pulls) before heavy loading.',
      'Do not spike pull volume — climbing, swimming, and heavy curl sessions back-to-back.',
      'Progress carry weight no more than 10% per week.',
    ],
  },

  lower_abdomen_forearm: {
    region: 'Lower Abdomen & Forearm',
    muscles: ['Rectus abdominis (lower)', 'Iliopsoas', 'Flexor digitorum superficialis', 'Flexor carpi radialis', 'Pronator teres'],
    acuteManagement: 'Ice forearm flexors if acute strain. Heat for lower abdominal tightness. Reduce grip-intensive work for 48h.',
    modality: 'both',
    returnToTrainDays: { mild: 2, moderate: 4, severe: 10 },
    stretches: [
      { name: 'Wrist Extension Stretch', duration: '30s each side', instruction: 'Arm straight, palm facing away. Press fingers back with opposite hand. Feel stretch through forearm flexors.' },
      { name: 'Hip Flexor Kneeling Stretch', duration: '45s each side', instruction: 'One knee on floor, opposite foot forward. Drive front hip forward, keep torso tall.' },
      { name: 'Forearm Flexor Stretch (supinated)', duration: '30s each side', instruction: 'Arm straight, palm facing up, fingers pressed gently downward.' },
    ],
    recoveryExercises: [
      { name: 'Reverse Wrist Curl', sets: '3', reps: '15', notes: 'Strengthens wrist extensors to balance forearm flexor dominance.' },
      { name: 'Leg Raise (bent knee)', sets: '3', reps: '10', notes: 'Trains lower abdominal region with minimal hip flexor recruitment.' },
      { name: 'Dead Bug', sets: '3', reps: '8 each side', notes: 'Lower abdominal activation with anti-extension challenge.' },
    ],
    maintenanceExercises: ['Wrist roller daily', 'Farmer carry 2×/week', 'Hip flexor stretch pre-ruck'],
    preventionTips: [
      'Use chalk or straps on grip-max days to reduce forearm fatigue accumulation.',
      'Stretch hip flexors before and after every ruck — especially with loads above 15 kg.',
      'Vary grip orientation across the week: supinated, pronated, neutral pulls.',
    ],
  },

  hip_groin: {
    region: 'Hip Flexor & Groin',
    muscles: ['Iliopsoas', 'Rectus femoris', 'Adductor longus', 'Adductor magnus', 'Pectineus', 'Gracilis'],
    acuteManagement: 'Ice 20 min every 2h for 48h. Compression shorts. Avoid sprinting, lateral cuts, and loaded lunges. Non-weight-bearing rest for severe groin strain.',
    modality: 'rice',
    returnToTrainDays: { mild: 3, moderate: 7, severe: 21 },
    stretches: [
      { name: 'Kneeling Hip Flexor Stretch', duration: '45s each side', instruction: 'Rear knee on floor, drive front hip forward. Keep torso upright, no anterior pelvic tilt.' },
      { name: 'Butterfly Groin Stretch', duration: '45s', instruction: 'Seated, soles together, elbows press knees gently toward floor. Do not force.' },
      { name: 'Pigeon Pose', duration: '60s each side', instruction: 'Front leg at 90° externally rotated, rear leg extended. Sink hips evenly toward floor.' },
    ],
    recoveryExercises: [
      { name: 'Clamshell', sets: '3', reps: '15 each side', notes: 'Hip external rotation — strengthens glute med, reduces adductor compensatory load during walking.' },
      { name: 'Side-Lying Hip Abduction', sets: '3', reps: '12 each side', notes: 'Isolates hip abductors. Critical for groin injury rehabilitation.' },
      { name: 'Glute Bridge', sets: '3', reps: '15', notes: 'Trains glute max, reduces anterior hip dominance that strains hip flexors.' },
    ],
    maintenanceExercises: ['Copenhagen plank 3×/week', 'Single-leg deadlift 2×/week', 'Lateral band walk pre-session'],
    preventionTips: [
      'Groin strains peak during explosive direction changes — always warm up adductors with dynamic lateral lunges.',
      'Weak glute med is the primary groin injury driver — programme lateral hip work year-round.',
      'Never sprint in cold weather without a minimum 10-min dynamic warm-up.',
    ],
  },

  quadriceps: {
    region: 'Quadriceps & Inner Thigh',
    muscles: ['Rectus femoris', 'Vastus lateralis', 'Vastus medialis (VMO)', 'Vastus intermedius', 'Adductor longus', 'Gracilis'],
    acuteManagement: 'Ice 20 min every 2–3h for 48h. Compression wrap. Avoid forced knee flexion and any loaded squatting.',
    modality: 'ice',
    returnToTrainDays: { mild: 3, moderate: 7, severe: 21 },
    stretches: [
      { name: 'Standing Quad Stretch', duration: '30s each side', instruction: 'Pull heel toward glute, knees together, stand tall. Support on wall if needed.' },
      { name: 'Prone Quad Stretch', duration: '45s each side', instruction: 'Face down, assist heel toward glute with hand. Stronger rectus femoris bias than standing version.' },
      { name: 'Couch Stretch', duration: '60s each side', instruction: 'Rear foot on couch or wall, front foot forward at 90°. Deepest hip flexor + quad stretch.' },
    ],
    recoveryExercises: [
      { name: 'Wall Sit (isometric)', sets: '3', reps: '20–30s', notes: 'Isometric quad load in mid-range. Safe during acute phase, builds tolerance.' },
      { name: 'Terminal Knee Extension (band)', sets: '3', reps: '15', notes: 'Band behind knee, straighten leg against resistance. VMO targeted activation.' },
      { name: 'Straight Leg Raise', sets: '3', reps: '15', notes: 'Maintains quad activation without knee flexion stress.' },
    ],
    maintenanceExercises: ['Eccentric step-down 3×/week', 'Spanish squat 2×/week', 'Leg extension (light, 3s lowering)'],
    preventionTips: [
      'Eccentric quad strength is the primary protective factor — Spanish squats and step-downs are underused.',
      'Progress ruck/run volume no more than 10% per week. Sudden mileage spikes are the leading quad injury cause.',
      'Foam roll quads pre-session — reduces DOMS and peak tissue stress during loading.',
    ],
  },

  upper_back_shoulder: {
    region: 'Upper Back & Posterior Shoulder',
    muscles: ['Trapezius (mid/lower)', 'Rhomboids', 'Posterior deltoid', 'Infraspinatus', 'Teres minor', 'Supraspinatus'],
    acuteManagement: 'Heat and gentle massage for muscular tension. Ice for acute rotator cuff injury or labral irritation. Avoid overhead and behind-the-neck loading.',
    modality: 'both',
    returnToTrainDays: { mild: 2, moderate: 5, severe: 14 },
    stretches: [
      { name: 'Cross-Body Posterior Shoulder Stretch', duration: '30s each side', instruction: 'Pull arm across chest at shoulder height. Feel stretch deep in posterior shoulder.' },
      { name: 'Thread the Needle', duration: '30s each side', instruction: 'Quadruped — reach one arm under body, rotate thorax to follow. Mid-back rotation.' },
      { name: "Child's Pose with Arm Reach", duration: '45s each side', instruction: 'Reach arm laterally from child\'s pose. Biases lat and teres stretch.' },
    ],
    recoveryExercises: [
      { name: 'Band Pull-Apart', sets: '3', reps: '20', notes: 'Horizontal abduction with band. Posterior shoulder, mid-trap, rhomboids. Daily exercise.' },
      { name: 'Face Pull', sets: '3', reps: '15', notes: 'External rotation + horizontal abduction. Gold standard posterior shoulder and rotator cuff exercise.' },
      { name: 'Y-T-W Prone', sets: '3', reps: '10 each position', notes: 'Lower trap and scapular stabiliser activation. Use body weight before adding load.' },
    ],
    maintenanceExercises: ['Face pulls 3×/week', 'Prone T-raise 2×/week', 'Farmer carry with scapular retraction cue'],
    preventionTips: [
      'Cue scapular retraction and depression during all loaded carries.',
      'Maintain 2:1 pull-to-push ratio in weekly programming.',
      'Never skip rowing — it prevents the anterior shoulder dominance that causes posterior shoulder overload.',
    ],
  },

  mid_back_triceps: {
    region: 'Mid Back & Triceps',
    muscles: ['Latissimus dorsi', 'Serratus anterior', 'Triceps brachii (long head)', 'Anconeus', 'Thoracic erector spinae'],
    acuteManagement: 'Ice triceps strains for 48h. Heat or foam rolling for thoracic tightness. Avoid locked-out overhead extension.',
    modality: 'both',
    returnToTrainDays: { mild: 2, moderate: 5, severe: 14 },
    stretches: [
      { name: 'Overhead Tricep Stretch', duration: '30s each side', instruction: 'Elbow behind head, hand reaches toward opposite shoulder blade. Other hand assists at elbow.' },
      { name: 'Lat Stretch on Wall', duration: '45s each side', instruction: 'One hand on wall above head, shift hips away from wall. Full lat length stretch.' },
      { name: 'T-Spine Foam Roll Extension', duration: '60s', instruction: 'Roller across mid-back at each thoracic segment. Arms crossed on chest. Extend over roller slowly.' },
    ],
    recoveryExercises: [
      { name: 'Cable Overhead Tricep Extension (light)', sets: '3', reps: '15', notes: 'Full range, slow lowering. Maintains long-head flexibility without joint stress.' },
      { name: 'Straight Arm Pulldown', sets: '3', reps: '12', notes: 'Lat and long-head tricep. Low joint stress, high tissue stimulus.' },
      { name: 'Serratus Wall Slide', sets: '3', reps: '10', notes: 'Hands on wall, slide up as scapulae protract. Critical serratus activation for overhead mechanics.' },
    ],
    maintenanceExercises: ['Dead hangs 3 × 30s', 'Cable tricep pushdown (full ROM)', 'T-spine foam roll pre-session'],
    preventionTips: [
      'Foam roll T-spine before pressing sessions — stiff thoracic extension forces shoulder compensation.',
      'Limit consecutive max-effort pushing days — triceps long head accumulates fatigue rapidly under volume.',
      'Train full tricep ROM — partial-range training shortens soft tissue over time.',
    ],
  },

  lower_back: {
    region: 'Lower Back & Lumbar Spine',
    muscles: ['Lumbar erector spinae', 'Multifidus', 'Quadratus lumborum', 'Psoas major', 'Thoracolumbar fascia'],
    acuteManagement: 'Ice 20 min every 2h for 24h, then switch to heat. Maintain comfortable movement — bed rest is counterproductive beyond 24h. No rucking until pain-free at rest.',
    modality: 'both',
    returnToTrainDays: { mild: 3, moderate: 10, severe: 28 },
    stretches: [
      { name: 'Knee-to-Chest', duration: '45s each side', instruction: 'Pull single knee toward chest, opposite leg flat. Decompresses lumbar facets.' },
      { name: 'Figure-4 Piriformis Stretch', duration: '45s each side', instruction: 'Lying on back, cross one ankle over opposite knee, pull thigh toward chest.' },
      { name: 'Cat-Cow', duration: '10 slow cycles', instruction: 'Hands and knees, alternate between full flexion and extension. Pumps lumbar disc nutrition.' },
    ],
    recoveryExercises: [
      { name: 'Bird Dog', sets: '3', reps: '8 each side', notes: 'Contralateral arm/leg extension in neutral spine. Primary multifidus and glute activation exercise.' },
      { name: 'Dead Bug', sets: '3', reps: '8 each side', notes: 'Supine, maintain lumbar neutral while extending opposite arm/leg. Trains transverse abdominis.' },
      { name: 'Glute Bridge', sets: '3', reps: '15', notes: 'Reduces lumbar erector dominance, shifts load to glutes where it belongs.' },
    ],
    maintenanceExercises: ['McGill Big 3 daily (curl-up, side plank, bird dog)', 'Romanian deadlift 2×/week', 'Plank progression 3×/week'],
    preventionTips: [
      'Ruck load riding low dramatically increases lumbar moment arm — pack must ride high, weight transferred to hip belt.',
      'Master the hip hinge movement pattern before any posterior chain loading.',
      'Pre-training activation: bird dogs and dead bugs before every heavy lower-body session.',
    ],
  },

  glutes_hamstrings: {
    region: 'Gluteus & Hamstrings',
    muscles: ['Gluteus maximus', 'Gluteus medius', 'Biceps femoris', 'Semitendinosus', 'Semimembranosus', 'Piriformis'],
    acuteManagement: 'Ice 20 min every 2–3h for 48h. Compression shorts. Avoid sprinting and deep hip flexion under load. Grade 2+ strain: full weight-bearing rest initially.',
    modality: 'rice',
    returnToTrainDays: { mild: 3, moderate: 7, severe: 21 },
    stretches: [
      { name: 'Standing Hamstring Stretch', duration: '45s each side', instruction: 'Foot on raised surface, slight knee bend, hinge at hip — not at waist. Keep spine long.' },
      { name: 'Pigeon Pose', duration: '60s each side', instruction: 'Front shin at 90°, rear leg extended. Sink hips evenly toward floor. Targets piriformis and glute max.' },
      { name: 'Supine Hamstring Stretch (towel)', duration: '45s each side', instruction: 'Lying on back, loop towel around foot, straighten leg toward ceiling. Control the range.' },
    ],
    recoveryExercises: [
      { name: 'Romanian Deadlift (light)', sets: '3', reps: '10', notes: 'Eccentric hamstring loading is the gold standard for strain prevention and rehabilitation.' },
      { name: 'Single-Leg Glute Bridge', sets: '3', reps: '12 each side', notes: 'Unilateral glute max activation. Identifies left-right strength asymmetry.' },
      { name: 'Nordic Hamstring Curl (negative only)', sets: '2', reps: '5 slow', notes: 'Ankles held, lower under control only. Use only in sub-acute phase (pain-free at rest).' },
    ],
    maintenanceExercises: ['Nordic curls 2×/week', 'Single-leg RDL 2×/week', 'Hip thrust progression'],
    preventionTips: [
      'Nordic curls reduce hamstring strain risk by 51% (Petersen et al. 2011). Add to programming immediately after return to train.',
      'Ensure glute max fires before hamstrings in hip extension — test with single-leg bridge and palpate glute timing.',
      'Full dynamic warm-up before running/jumping: leg swings, A-skips, high-knee march.',
    ],
  },

  calf_achilles: {
    region: 'Calf & Achilles Tendon',
    muscles: ['Gastrocnemius', 'Soleus', 'Plantaris', 'Peroneus longus', 'Tibialis posterior', 'Flexor hallucis longus'],
    acuteManagement: 'RICE for acute strain. Heel raise insole to offload Achilles. Return-to-run criterion: pain-free single-leg calf raise × 25 reps.',
    modality: 'rice',
    returnToTrainDays: { mild: 3, moderate: 10, severe: 42 },
    stretches: [
      { name: 'Standing Calf Stretch (straight knee)', duration: '45s each side', instruction: 'Hands on wall, rear leg straight, heel pressed into floor. Targets gastrocnemius.' },
      { name: 'Standing Calf Stretch (bent knee)', duration: '45s each side', instruction: 'Same position, rear knee bent 15–20°. Targets soleus and Achilles insertion.' },
      { name: 'Towel Ankle Stretch', duration: '45s each side', instruction: 'Loop towel around foot, pull toes toward shin. Gentle plantar fascia and Achilles.' },
    ],
    recoveryExercises: [
      { name: 'Eccentric Heel Drop', sets: '3', reps: '15 slow', notes: 'Stand on step, rise on both feet, lower on one. Alfredson protocol — the evidence-based Achilles tendinopathy treatment.' },
      { name: 'Seated Calf Raise', sets: '3', reps: '15', notes: 'Knee at 90°, weight on knees. Isolates soleus. Critical for Achilles and plantar fascia rehab.' },
      { name: 'Single-Leg Balance', sets: '3', reps: '30s', notes: 'Eyes open then closed. Proprioception and peroneal stability.' },
    ],
    maintenanceExercises: ['Eccentric heel drops 3×/week', 'Seated calf raise with slow lowering', 'Ankle mobility circles daily'],
    preventionTips: [
      'Progressive mileage increase: calf/Achilles is the limiting structure before knees and hips in most runners.',
      'Avoid abrupt surface changes (tarmac to trail) without adaptation — terrain variation increases Achilles load significantly.',
      'Check footwear heel drop — low-drop shoes require a 4–6 week adaptation period to avoid Achilles overload.',
    ],
  },

  ankle_foot: {
    region: 'Ankle & Foot',
    muscles: ['Tibialis anterior', 'Peroneus brevis', 'Plantar fascia', 'Intrinsic foot muscles', 'Extensor hallucis longus'],
    acuteManagement: 'Apply Ottawa Rules: if unable to weight-bear 4 steps, or point tenderness on malleoli, seek X-ray. RICE for sprains. Compression and elevation.',
    modality: 'rice',
    returnToTrainDays: { mild: 3, moderate: 10, severe: 28 },
    stretches: [
      { name: 'Plantar Fascia Stretch', duration: '30s each side', instruction: 'Cross foot over knee, pull toes back toward shin. Also roll foot over tennis ball or frozen bottle.' },
      { name: 'Ankle Circles', duration: '10 circles each direction × 2', instruction: 'Full ROM rotation. Maintains proprioception and joint mobility in sub-acute phase.' },
      { name: 'Calf Stretch (both knee positions)', duration: '30s × 2 positions each side', instruction: 'Straight then bent knee version to address full triceps surae length.' },
    ],
    recoveryExercises: [
      { name: 'Alphabet Ankle', sets: '2', reps: '1 full alphabet', notes: 'Trace A–Z in air with big toe. Full ankle ROM in all planes. Do 2–3× daily early rehab.' },
      { name: 'Resistance Band Eversion', sets: '3', reps: '15', notes: 'Band around foot, evert against resistance. Peroneal strengthening — primary lateral ankle sprain prevention.' },
      { name: 'Single-Leg Balance Progression', sets: '3', reps: '30s → eyes closed → unstable surface', notes: 'Proprioceptive ladder. Recurrent ankle sprain prevention.' },
    ],
    maintenanceExercises: ['Single-leg balance on BOSU or folded mat 3×/week', 'Foot doming exercise daily', 'Calf raise with slow lowering'],
    preventionTips: [
      'After first lateral ankle sprain, recurrence rate is 70% without rehabilitation. Taping or bracing for 6 months post-injury.',
      'Foot doming: strengthen arch intrinsics — place foot flat, shorten the arch without curling toes. Prevents plantar fasciitis.',
      'Military boot fit: excessive heel drop and narrow toe box are leading injury factors — check fit every 6 months under operational load.',
    ],
  },

  general: {
    region: 'General Musculoskeletal',
    muscles: [],
    acuteManagement: 'RICE: Rest, Ice 20 min/hour, Compression, Elevation. If no improvement in 72h or worsening symptoms, refer to HPT physiotherapist.',
    modality: 'rice',
    returnToTrainDays: { mild: 2, moderate: 7, severe: 21 },
    stretches: [
      { name: 'Full Body Mobility Circuit', duration: '5–10 min', instruction: 'Neck rolls, shoulder circles, hip circles, ankle circles. Address the affected region specifically.' },
    ],
    recoveryExercises: [
      { name: 'Active Recovery Walk', sets: '1', reps: '20–30 min', notes: 'Low-intensity movement promotes healing blood flow without tissue stress.' },
    ],
    maintenanceExercises: ['Daily mobility work 10 min', 'Progressive loading return to baseline'],
    preventionTips: [
      'Address pain early — training through it accelerates tissue damage.',
      'Adequate sleep and nutrition are the primary recovery accelerators.',
      'Progressive overload: no more than 10% volume increase per week.',
    ],
  },
};
