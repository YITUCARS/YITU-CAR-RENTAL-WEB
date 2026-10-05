// Top-down road scenes on a 400×300 stage. NZ drives on the left, so a car
// heading east (→) uses the top lane and a car heading west (←) the bottom lane.
// Rotation is in SVG degrees: 0 points right, -90 up, 90 down, 180 left.

export type Text = { en: string; zh: string }
export type Pose = { t: number; x: number; y: number; r: number }
export type Signal = { from: number; to: number; side: 'left' | 'right' }
// `signals` overrides the automatic indicators (used where a path keeps
// curving, like a roundabout, or for gentle lane changes).
export type Actor = { id: string; kind: 'hero' | 'car' | 'van'; keys: Pose[]; signals?: Signal[] }
export type Variant = {
    actors: Actor[]
    captions: (Text & { t: number })[]
    crash?: { t: number; x: number; y: number }
}
export type SceneKind = 'keepLeft' | 'roundabout' | 'bridge' | 'turnGiveWay' | 'overtake'
export type Choice = { id: string; label: Text; icon: 'left' | 'straight' | 'right'; variant: Variant }
// A scenario either contrasts the right way with a common mistake, or lets
// the visitor pick between several correct manoeuvres.
export type Scenario = {
    id: string
    scene: SceneKind
    title: Text
    rule: Text
    tip: Text
} & ({ correct: Variant; mistake: Variant; choices?: never } | { choices: Choice[]; correct?: never; mistake?: never })

export type ScenarioOption = { id: string; tone: 'correct' | 'mistake' | 'choice'; label?: Text; icon?: Choice['icon']; variant: Variant }

export function optionsOf(scenario: Scenario): ScenarioOption[] {
    if (scenario.choices) return scenario.choices.map(choice => ({ ...choice, tone: 'choice' }))
    return [
        { id: 'correct', tone: 'correct', variant: scenario.correct },
        { id: 'mistake', tone: 'mistake', variant: scenario.mistake },
    ]
}

const RING = { cx: 200, cy: 150, r: 54 }

// Poses along the roundabout lane from angle a0 to a1 (degrees, SVG angles:
// increasing = clockwise on screen) between times t0 and t1.
function arc(a0: number, a1: number, t0: number, t1: number, steps = 6): Pose[] {
    const heading = a1 > a0 ? 90 : -90
    return Array.from({ length: steps + 1 }, (_, i) => {
        const a = a0 + ((a1 - a0) * i) / steps
        const rad = (a * Math.PI) / 180
        return {
            t: t0 + ((t1 - t0) * i) / steps,
            x: RING.cx + RING.r * Math.cos(rad),
            y: RING.cy + RING.r * Math.sin(rad),
            r: a + heading,
        }
    })
}

export const SCENARIOS: Scenario[] = [
    {
        id: 'keep-left',
        scene: 'keepLeft',
        title: { en: 'Keep left after turning', zh: '转弯后靠左行驶' },
        rule: {
            en: 'New Zealand drives on the left. After every turn — especially out of car parks, petrol stations and quiet side roads — make sure you end up on the left side of the road.',
            zh: '新西兰靠左行驶。每次转弯后（尤其是从停车场、加油站或安静的小路驶出时），都要确认车辆在道路左侧。',
        },
        tip: {
            en: 'Say “keep left” out loud at every turn for the first few days. The driver sits next to the centre line.',
            zh: '头几天每次转弯都默念“靠左”。记住：驾驶员一侧靠近道路中线。',
        },
        correct: {
            actors: [
                { id: 'oncoming', kind: 'car', keys: [{ t: 0, x: 430, y: 168, r: 180 }, { t: 0.65, x: -30, y: 168, r: 180 }] },
                {
                    id: 'hero', kind: 'hero', keys: [
                        { t: 0, x: 189, y: 320, r: -90 }, { t: 0.25, x: 189, y: 206, r: -90 }, { t: 0.5, x: 189, y: 206, r: -90 },
                        { t: 0.58, x: 192, y: 162, r: -70 }, { t: 0.66, x: 206, y: 140, r: -35 }, { t: 0.74, x: 232, y: 132, r: 0 },
                        { t: 1, x: 430, y: 132, r: 0 },
                    ],
                },
            ],
            captions: [
                { t: 0, en: 'Leaving a side road, you want to turn right.', zh: '从路口驶出，准备右转。' },
                { t: 0.25, en: 'Stop and give way. Turning right crosses the near lane.', zh: '先停下让行，右转要横穿近侧车道。' },
                { t: 0.52, en: 'Turn into the FAR lane — keep left!', zh: '转入远侧车道——靠左行驶！' },
                { t: 0.8, en: '✓ You are on the left side of the road.', zh: '✓ 车辆行驶在道路左侧。' },
            ],
        },
        mistake: {
            actors: [
                { id: 'oncoming', kind: 'car', keys: [{ t: 0.2, x: 430, y: 168, r: 180 }, { t: 1, x: -30, y: 168, r: 180 }] },
                {
                    id: 'hero', kind: 'hero', keys: [
                        { t: 0, x: 189, y: 320, r: -90 }, { t: 0.25, x: 189, y: 206, r: -90 },
                        { t: 0.35, x: 200, y: 175, r: -40 }, { t: 0.42, x: 225, y: 168, r: 0 }, { t: 1, x: 430, y: 168, r: 0 },
                    ],
                },
            ],
            captions: [
                { t: 0, en: 'Same turn — but out of habit you keep right…', zh: '同样右转，但习惯性靠右……' },
                { t: 0.3, en: 'Turning into the NEAR lane puts you on the wrong side.', zh: '转入近侧车道就是逆行。' },
                { t: 0.48, en: '✗ Head-on with oncoming traffic.', zh: '✗ 与对向来车迎面相撞。' },
            ],
            crash: { t: 0.48, x: 258, y: 168 },
        },
    },
    {
        id: 'roundabout',
        scene: 'roundabout',
        title: { en: 'Roundabouts: give way to the right', zh: '环岛：让行右侧来车' },
        rule: {
            en: 'Give way to all traffic coming from your right, then enter turning left and drive clockwise around the roundabout.',
            zh: '让行所有从右侧来的车辆，然后左转进入环岛，顺时针绕行。',
        },
        tip: {
            en: 'Signal left just before your exit so other drivers know you are leaving.',
            zh: '在要驶出的出口前打左转灯，让其他车辆知道你要离开环岛。',
        },
        correct: {
            actors: [
                {
                    id: 'ring', kind: 'car', signals: [{ from: 0.36, to: 0.47, side: 'left' }], keys: [
                        { t: 0, x: 430, y: 161, r: 180 }, { t: 0.12, x: 270, y: 161, r: 180 },
                        ...arc(30, 150, 0.17, 0.42), { t: 0.47, x: 130, y: 161, r: 180 }, { t: 0.65, x: -30, y: 161, r: 180 },
                    ],
                },
                {
                    id: 'hero', kind: 'hero', signals: [{ from: 0.71, to: 0.84, side: 'left' }], keys: [
                        { t: 0, x: 189, y: 320, r: -90 }, { t: 0.2, x: 189, y: 244, r: -90 }, { t: 0.5, x: 189, y: 244, r: -90 },
                        { t: 0.53, x: 189, y: 222, r: -90 }, ...arc(115, 235, 0.57, 0.77),
                        { t: 0.82, x: 189, y: 70, r: -90 }, { t: 1, x: 189, y: -30, r: -90 },
                    ],
                },
            ],
            captions: [
                { t: 0, en: 'Approach slowly and look RIGHT.', zh: '减速靠近，向右看。' },
                { t: 0.2, en: 'Give way to every vehicle coming from your right.', zh: '让行所有从右侧来的车辆。' },
                { t: 0.5, en: 'Clear — enter turning left and drive clockwise.', zh: '确认安全后，左转进入，顺时针行驶。' },
                { t: 0.82, en: '✓ Signal left before your exit.', zh: '✓ 出环岛前打左转灯。' },
            ],
        },
        mistake: {
            actors: [
                {
                    id: 'ring', kind: 'car', signals: [{ from: 0.36, to: 0.47, side: 'left' }], keys: [
                        { t: 0, x: 430, y: 161, r: 180 }, { t: 0.12, x: 270, y: 161, r: 180 },
                        ...arc(30, 150, 0.17, 0.42), { t: 0.47, x: 130, y: 161, r: 180 }, { t: 0.65, x: -30, y: 161, r: 180 },
                    ],
                },
                {
                    id: 'hero', kind: 'hero', signals: [], keys: [
                        { t: 0, x: 189, y: 320, r: -90 }, { t: 0.2, x: 189, y: 244, r: -90 },
                        { t: 0.23, x: 190, y: 222, r: -90 }, ...arc(80, -30, 0.26, 0.58),
                    ],
                },
            ],
            captions: [
                { t: 0, en: 'Driving-on-the-right habit: you enter turning right…', zh: '按右行习惯，进环岛时向右转……' },
                { t: 0.18, en: '…without giving way to the car already on the roundabout.', zh: '……也没有让行环岛内的车辆。' },
                { t: 0.245, en: '✗ Head-on inside the roundabout.', zh: '✗ 在环岛内迎面相撞。' },
            ],
            crash: { t: 0.245, x: 211, y: 206 },
        },
    },
    {
        id: 'one-lane-bridge',
        scene: 'bridge',
        title: { en: 'One-lane bridges', zh: '单车道桥' },
        rule: {
            en: 'If there is a Give Way sign on your side, stop before the bridge and let oncoming traffic cross first. Even when you have priority, slow down and check the bridge is clear.',
            zh: '如果你这一侧有让行标志，要在桥前停车，先让对向车辆过桥。即使你有优先权，也要减速，确认桥上没有车。',
        },
        tip: {
            en: 'One-lane bridges are common on South Island highways, often just after a bend. Watch for the warning signs.',
            zh: '南岛公路上单车道桥很常见，常常就在弯道后面，留意提前出现的警示标志。',
        },
        correct: {
            actors: [
                {
                    id: 'oncoming', kind: 'car', keys: [
                        { t: 0, x: 430, y: 168, r: 180 }, { t: 0.19, x: 276, y: 168, r: 180 }, { t: 0.225, x: 260, y: 160, r: 180 },
                        { t: 0.26, x: 242, y: 150, r: 180 }, { t: 0.42, x: 150, y: 150, r: 180 },
                        { t: 0.455, x: 128, y: 160, r: 180 }, { t: 0.49, x: 106, y: 168, r: 180 }, { t: 0.7, x: -30, y: 168, r: 180 },
                    ],
                },
                {
                    id: 'hero', kind: 'hero', keys: [
                        { t: 0, x: -30, y: 132, r: 0 }, { t: 0.2, x: 112, y: 132, r: 0 }, { t: 0.55, x: 112, y: 132, r: 0 },
                        { t: 0.58, x: 124, y: 133, r: 0 }, { t: 0.605, x: 140, y: 143, r: 0 }, { t: 0.63, x: 158, y: 150, r: 0 }, { t: 0.75, x: 250, y: 150, r: 0 }, { t: 0.82, x: 282, y: 132, r: 0 },
                        { t: 1, x: 430, y: 132, r: 0 },
                    ],
                },
            ],
            captions: [
                { t: 0, en: 'One-lane bridge ahead — check the signs.', zh: '前方单车道桥，注意标志。' },
                { t: 0.18, en: 'Give Way sign on your side: stop before the bridge.', zh: '你这侧有让行标志：在桥前停车。' },
                { t: 0.3, en: 'Let the oncoming car cross first.', zh: '先让对向车辆过桥。' },
                { t: 0.6, en: '✓ Bridge clear — now it is your turn.', zh: '✓ 桥上没有车了，再通过。' },
            ],
        },
        mistake: {
            actors: [
                {
                    id: 'oncoming', kind: 'car', keys: [
                        { t: 0, x: 430, y: 168, r: 180 }, { t: 0.19, x: 276, y: 168, r: 180 }, { t: 0.225, x: 260, y: 160, r: 180 },
                        { t: 0.26, x: 242, y: 150, r: 180 }, { t: 0.42, x: 150, y: 150, r: 180 },
                    ],
                },
                {
                    id: 'hero', kind: 'hero', keys: [
                        { t: 0, x: -30, y: 132, r: 0 }, { t: 0.22, x: 150, y: 150, r: 0 }, { t: 0.45, x: 250, y: 150, r: 0 },
                    ],
                },
            ],
            captions: [
                { t: 0, en: 'Rushing onto the bridge without checking…', zh: '没看标志就直接上桥……' },
                { t: 0.31, en: '✗ Face to face on a one-lane bridge.', zh: '✗ 在单车道桥上与对向车迎面相撞。' },
            ],
            crash: { t: 0.31, x: 202, y: 150 },
        },
    },
    {
        id: 'turning-give-way',
        scene: 'turnGiveWay',
        title: { en: 'Turning right gives way to left turns', zh: '右转让对向左转' },
        rule: {
            en: 'At an intersection, if you are turning right and an oncoming vehicle is turning left into the same road, you must give way to it. Turning traffic also gives way to all traffic going straight.',
            zh: '在路口，如果你右转、对向车辆左转，并且你们要驶入同一条路，你必须让它先走。转弯车辆还要让行所有直行车辆。',
        },
        tip: {
            en: 'New Zealand changed this rule in 2012, so some older guides still describe the opposite. When in doubt, wait.',
            zh: '新西兰在 2012 年修改过这条规则，一些旧资料写的还是相反的规则。拿不准时就先等一等。',
        },
        correct: {
            actors: [
                {
                    id: 'oncoming', kind: 'car', keys: [
                        { t: 0, x: 211, y: -30, r: 90 }, { t: 0.25, x: 211, y: 112, r: 90 }, { t: 0.3, x: 216, y: 130, r: 60 },
                        { t: 0.35, x: 232, y: 138, r: 10 }, { t: 0.4, x: 260, y: 139, r: 0 }, { t: 0.65, x: 430, y: 139, r: 0 },
                    ],
                },
                {
                    id: 'hero', kind: 'hero', keys: [
                        { t: 0, x: 189, y: 320, r: -90 }, { t: 0.25, x: 189, y: 192, r: -90 }, { t: 0.45, x: 189, y: 192, r: -90 },
                        { t: 0.51, x: 192, y: 162, r: -80 }, { t: 0.56, x: 205, y: 146, r: -40 }, { t: 0.61, x: 228, y: 139, r: 0 },
                        { t: 1, x: 430, y: 139, r: 0 },
                    ],
                },
            ],
            captions: [
                { t: 0, en: 'You turn right; the oncoming car turns left — into the same road.', zh: '你右转，对向车左转，驶入同一条路。' },
                { t: 0.22, en: 'NZ rule: turning RIGHT gives way to the oncoming car turning LEFT.', zh: '新西兰规则：右转车让对向左转车。' },
                { t: 0.45, en: '✓ Let it go first, then turn right into the left lane.', zh: '✓ 让它先走，再右转进入左侧车道。' },
            ],
        },
        mistake: {
            actors: [
                {
                    id: 'oncoming', kind: 'car', keys: [
                        { t: 0, x: 211, y: -30, r: 90 }, { t: 0.25, x: 211, y: 112, r: 90 }, { t: 0.3, x: 216, y: 130, r: 60 },
                        { t: 0.35, x: 232, y: 138, r: 10 }, { t: 0.4, x: 260, y: 139, r: 0 }, { t: 0.65, x: 430, y: 139, r: 0 },
                    ],
                },
                {
                    id: 'hero', kind: 'hero', keys: [
                        { t: 0, x: 189, y: 320, r: -90 }, { t: 0.22, x: 189, y: 200, r: -90 }, { t: 0.27, x: 191, y: 166, r: -85 },
                        { t: 0.31, x: 203, y: 148, r: -45 }, { t: 0.35, x: 226, y: 139, r: 0 }, { t: 0.75, x: 430, y: 139, r: 0 },
                    ],
                },
            ],
            captions: [
                { t: 0, en: 'Cutting in front of the car turning left…', zh: '抢在对向左转车前面右转……' },
                { t: 0.31, en: '✗ Both cars cut into the same lane.', zh: '✗ 两车抢入同一车道相撞。' },
            ],
            crash: { t: 0.31, x: 211, y: 140 },
        },
    },
    {
        id: 'overtaking',
        scene: 'overtake',
        title: { en: 'No overtaking on solid yellow lines', zh: '黄色实线禁止超车' },
        rule: {
            en: 'Never cross a solid yellow no-passing line. Wait for a passing lane. If you are the slow vehicle, pull into a slow vehicle bay and let the queue pass.',
            zh: '绝不能越过黄色实线超车，耐心等到超车道再超。如果你是慢车，就驶入慢车避让区，让后面的车先过。',
        },
        tip: {
            en: 'Winding roads hide oncoming traffic. Allow extra time — NZ trips take longer than the map suggests.',
            zh: '弯道多的路段看不到对向来车。多留些时间，新西兰的车程往往比地图显示的更久。',
        },
        correct: {
            actors: [
                { id: 'oncoming', kind: 'car', keys: [{ t: 0.1, x: 430, y: 168, r: 180 }, { t: 0.9, x: -30, y: 168, r: 180 }] },
                {
                    id: 'van', kind: 'van', signals: [{ from: 0.27, to: 0.5, side: 'left' }], keys: [
                        { t: 0, x: 60, y: 132, r: 0 }, { t: 0.35, x: 200, y: 132, r: 0 }, { t: 0.42, x: 228, y: 122, r: -20 },
                        { t: 0.5, x: 262, y: 106, r: 0 }, { t: 0.7, x: 300, y: 106, r: 0 },
                    ],
                },
                {
                    id: 'hero', kind: 'hero', keys: [
                        { t: 0, x: -30, y: 132, r: 0 }, { t: 0.35, x: 150, y: 132, r: 0 }, { t: 0.45, x: 195, y: 132, r: 0 },
                        { t: 1, x: 430, y: 132, r: 0 },
                    ],
                },
            ],
            captions: [
                { t: 0, en: 'Stuck behind a slow campervan on a winding road?', zh: '山路上跟在慢速房车后面？' },
                { t: 0.18, en: 'Solid yellow line = no overtaking. Stay patient.', zh: '黄色实线 = 禁止超车，耐心跟车。' },
                { t: 0.4, en: 'The slower vehicle pulls into the slow vehicle bay.', zh: '慢车驶入慢车避让区。' },
                { t: 0.62, en: '✓ Pass safely in your own lane.', zh: '✓ 在本车道安全通过。' },
            ],
        },
        mistake: {
            actors: [
                { id: 'oncoming', kind: 'car', keys: [{ t: 0, x: 430, y: 168, r: 180 }, { t: 1, x: -30, y: 168, r: 180 }] },
                { id: 'van', kind: 'van', keys: [{ t: 0, x: 60, y: 132, r: 0 }, { t: 1, x: 260, y: 132, r: 0 }] },
                {
                    id: 'hero', kind: 'hero', signals: [{ from: 0.24, to: 0.38, side: 'right' }], keys: [
                        { t: 0, x: -30, y: 132, r: 0 }, { t: 0.28, x: 60, y: 132, r: 0 }, { t: 0.32, x: 85, y: 140, r: 0 },
                        { t: 0.37, x: 110, y: 160, r: 0 }, { t: 0.41, x: 140, y: 167, r: 0 }, { t: 0.6, x: 300, y: 168, r: 0 },
                    ],
                },
            ],
            captions: [
                { t: 0, en: 'Impatient: overtaking across the solid yellow line…', zh: '不耐烦，越过黄色实线超车……' },
                { t: 0.47, en: '✗ An oncoming car appears around the bend.', zh: '✗ 弯道后突然出现对向来车。' },
            ],
            crash: { t: 0.47, x: 201, y: 168 },
        },
    },
    {
        id: 'roundabout-signals',
        scene: 'roundabout',
        title: { en: 'Signalling at roundabouts', zh: '环岛打灯' },
        rule: {
            en: 'Approaching: turning left, signal left; going straight, no signal; turning right, signal right. Leaving: always signal left once you pass the exit before the one you want.',
            zh: '接近环岛时：左转打左灯，直行不打灯，右转打右灯。驶出时：经过你要走的出口的前一个出口后，一律打左灯。',
        },
        tip: {
            en: 'Not sure which exit? Go around again and only signal left when you are ready to leave.',
            zh: '不确定从哪个出口出？可以再绕一圈，准备驶出时再打左灯。',
        },
        choices: [
            {
                id: 'left', icon: 'left', label: { en: 'Turn left', zh: '左转' },
                variant: {
                    actors: [{
                        id: 'hero', kind: 'hero', signals: [{ from: 0, to: 0.58, side: 'left' }], keys: [
                            { t: 0, x: 189, y: 320, r: -90 }, { t: 0.22, x: 189, y: 244, r: -90 }, { t: 0.3, x: 189, y: 244, r: -90 },
                            { t: 0.34, x: 189, y: 222, r: -90 },
                            // The first exit is a short left turn that keeps to the left of the island.
                            { t: 0.4, x: 183, y: 192, r: -100 }, { t: 0.46, x: 166, y: 173, r: -135 },
                            { t: 0.52, x: 140, y: 163, r: 180 }, { t: 0.82, x: -30, y: 161, r: 180 },
                        ],
                    }],
                    captions: [
                        { t: 0, en: 'First exit (turning left): signal LEFT as you approach.', zh: '第一个出口左转：接近环岛时就打左灯。' },
                        { t: 0.22, en: 'Give way to traffic from your right, then enter.', zh: '让行右侧来车，然后进入环岛。' },
                        { t: 0.4, en: 'Keep signalling left until you have left the roundabout.', zh: '左灯一直打到驶出环岛。' },
                        { t: 0.6, en: '✓ Left signal the whole way.', zh: '✓ 全程打左灯。' },
                    ],
                },
            },
            {
                id: 'straight', icon: 'straight', label: { en: 'Straight ahead', zh: '直行' },
                variant: {
                    actors: [{
                        id: 'hero', kind: 'hero', signals: [{ from: 0.55, to: 0.74, side: 'left' }], keys: [
                            { t: 0, x: 189, y: 320, r: -90 }, { t: 0.22, x: 189, y: 244, r: -90 }, { t: 0.3, x: 189, y: 244, r: -90 },
                            { t: 0.34, x: 189, y: 222, r: -90 },
                            ...arc(115, 235, 0.4, 0.66),
                            { t: 0.72, x: 189, y: 70, r: -90 }, { t: 0.85, x: 189, y: -30, r: -90 },
                        ],
                    }],
                    captions: [
                        { t: 0, en: 'Going straight ahead: no signal as you approach.', zh: '直行：接近环岛时不用打灯。' },
                        { t: 0.22, en: 'Give way to traffic from your right, then enter and drive clockwise.', zh: '让行右侧来车，进入后顺时针行驶。' },
                        { t: 0.55, en: 'Passed the exit before yours: signal LEFT.', zh: '经过你出口的前一个出口后，打左灯。' },
                        { t: 0.76, en: '✓ The left signal tells others you are leaving.', zh: '✓ 左灯让其他车辆知道你要驶出。' },
                    ],
                },
            },
            {
                id: 'right', icon: 'right', label: { en: 'Turn right', zh: '右转' },
                variant: {
                    actors: [{
                        id: 'hero', kind: 'hero', signals: [{ from: 0, to: 0.68, side: 'right' }, { from: 0.68, to: 0.86, side: 'left' }], keys: [
                            { t: 0, x: 189, y: 320, r: -90 }, { t: 0.22, x: 189, y: 244, r: -90 }, { t: 0.3, x: 189, y: 244, r: -90 },
                            { t: 0.34, x: 189, y: 222, r: -90 },
                            ...arc(115, 330, 0.4, 0.78),
                            { t: 0.84, x: 270, y: 139, r: 0 }, { t: 0.96, x: 430, y: 139, r: 0 },
                        ],
                    }],
                    captions: [
                        { t: 0, en: 'Turning right (past halfway): signal RIGHT as you approach.', zh: '右转（超过半圈的出口）：接近时打右灯。' },
                        { t: 0.22, en: 'Give way, enter, and keep signalling right around the roundabout.', zh: '让行后进入，在环岛内保持右灯。' },
                        { t: 0.68, en: 'Passed the exit before yours: switch to LEFT.', zh: '经过前一个出口后，改打左灯。' },
                        { t: 0.88, en: '✓ Right on the way in, left on the way out.', zh: '✓ 进环岛打右灯，出环岛打左灯。' },
                    ],
                },
            },
        ],
    },
]

const isSamePoint = (a: Pose | undefined, b: Pose) => Boolean(a && Math.hypot(a.x - b.x, a.y - b.y) < 0.01)

// Velocity at a keyframe. A car pulling away from or stopping at a key has
// zero velocity there, so it eases in and out.
function velocityAt(keys: Pose[], i: number) {
    const key = keys[i]
    const prev = keys[i - 1]
    const next = keys[i + 1]
    if (isSamePoint(prev, key) || isSamePoint(next, key)) return { x: 0, y: 0 }
    const a = prev ?? key
    const b = next ?? key
    const dt = b.t - a.t
    return dt > 0 ? { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt } : { x: 0, y: 0 }
}

// A segment's end tangent may not be longer than the segment itself, so the
// curve rounds corners without overshooting them.
function clampTangent(v: { x: number; y: number }, h: number, chord: number) {
    const x = v.x * h
    const y = v.y * h
    const length = Math.hypot(x, y)
    return length > chord && length > 0 ? { x: (x * chord) / length, y: (y * chord) / length } : { x, y }
}

// Smooth (cubic Hermite) path through the keyframes. The car faces along the
// curve, so it never drifts sideways through a corner; the keyframe rotation
// is only used while it stands still.
export function poseAt(keys: Pose[], t: number): Pose | null {
    if (t < keys[0].t) return null
    const last = keys[keys.length - 1]
    if (t >= last.t) return last
    const i = keys.findIndex(key => key.t > t)
    const a = keys[i - 1]
    const b = keys[i]
    const h = b.t - a.t
    const s = (t - a.t) / h
    const chord = Math.hypot(b.x - a.x, b.y - a.y)
    const ta = clampTangent(velocityAt(keys, i - 1), h, chord)
    const tb = clampTangent(velocityAt(keys, i), h, chord)
    const x = (2 * s ** 3 - 3 * s ** 2 + 1) * a.x + (s ** 3 - 2 * s ** 2 + s) * ta.x + (3 * s ** 2 - 2 * s ** 3) * b.x + (s ** 3 - s ** 2) * tb.x
    const y = (2 * s ** 3 - 3 * s ** 2 + 1) * a.y + (s ** 3 - 2 * s ** 2 + s) * ta.y + (3 * s ** 2 - 2 * s ** 3) * b.y + (s ** 3 - s ** 2) * tb.y
    const dx = (6 * s ** 2 - 6 * s) * (a.x - b.x) + (3 * s ** 2 - 4 * s + 1) * ta.x + (3 * s ** 2 - 2 * s) * tb.x
    const dy = (6 * s ** 2 - 6 * s) * (a.y - b.y) + (3 * s ** 2 - 4 * s + 1) * ta.y + (3 * s ** 2 - 2 * s) * tb.y
    if (chord > 0.01 && Math.hypot(dx, dy) > 1e-9) return { t, x, y, r: (Math.atan2(dy, dx) * 180) / Math.PI }
    return { t, x, y, r: a.r }
}

const SIGNAL_LOOK_AHEAD = 70
const SIGNAL_LOOK_BACK = 20
const SIGNAL_MIN_TURN = 50

// Which indicator a car shows at time t. Unless the scenario says otherwise,
// a car indicates while the road ahead (or the bend it is in) turns by more
// than SIGNAL_MIN_TURN degrees: the way a driver signals while waiting to
// turn and through the turn, then cancels once straight.
export function signalAt(actor: Actor, t: number): Signal['side'] | null {
    if (actor.signals) return actor.signals.find(s => t >= s.from && t < s.to)?.side ?? null
    const now = poseAt(actor.keys, t)
    if (!now) return null
    const last = actor.keys[actor.keys.length - 1].t
    const walk = (direction: 1 | -1, distance: number) => {
        let previous = now
        let travelled = 0
        for (let time = t + direction * 0.005; time >= actor.keys[0].t && time <= last; time += direction * 0.005) {
            const pose = poseAt(actor.keys, time)!
            travelled += Math.hypot(pose.x - previous.x, pose.y - previous.y)
            previous = pose
            if (travelled >= distance) break
        }
        return previous
    }
    const turn = ((((walk(1, SIGNAL_LOOK_AHEAD).r - walk(-1, SIGNAL_LOOK_BACK).r) % 360) + 540) % 360) - 180
    if (Math.abs(turn) < SIGNAL_MIN_TURN) return null
    // SVG angles grow clockwise on screen, so a positive turn is to the right.
    return turn > 0 ? 'right' : 'left'
}
