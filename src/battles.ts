// 通用战役模式数据。新增战役 = 向 BATTLES 追加一个 Battle 对象，无需改引擎/UI。
import type { EventType, LonLat } from './data';

export interface BattleRoute {
  id: string;
  label: string;
  color: number;
  glow: number;
  points: [string, number, number][];
}

export interface BattleEnemy {
  id: string;
  label: string;
  force: string;
  kind: 'pursue' | 'block' | 'defend' | 'encircle';
  from: LonLat;
  to: LonLat;
  start: string;
  end: string;
  note?: string;
}

export interface BattleEvent {
  id: string;
  date: string;
  endDate?: string;
  lon: number;
  lat: number;
  name: string;
  type: EventType;
  place: string;
  summary: string;
  result: string;
  significance?: string;
}

// 解说节拍：随播放自动高亮，点击可跳转（复刻白板讲解的逐步叙事）
export interface BattleStep {
  date: string;
  title: string;
  text: string;
}

// 合围环：随时间收缩的虚线圆，直观表现敌人包围圈收紧
export interface EncircleRing {
  center: LonLat;
  radiusStart: number; // 度
  radiusEnd: number;
  start: string;
  end: string;
  label?: string;
}

export interface Battle {
  id: string;
  name: string;
  subtitle: string;
  intro: string;
  conclusion: string;
  start: string;
  end: string;
  region: { lonMin: number; lonMax: number; latMin: number; latMax: number };
  red: BattleRoute[];
  enemy: BattleEnemy[];
  events: BattleEvent[];
  steps: BattleStep[];
  ring?: EncircleRing;
}

export const BATTLES: Battle[] = [
  {
    id: 'chishui',
    name: '四渡赤水',
    subtitle: '1935.1 — 1935.4 · 运动战典范',
    intro: '3万红军对40万敌军。毛泽东以四次渡赤水来回调动敌人，声东击西、避实击虚，最终跳出重围——其军事生涯的"得意之笔"。',
    conclusion: '四渡赤水历时近三个月：红军以3万之众调动40万敌军，四渡赤水、南渡乌江、佯攻贵阳，彻底跳出包围圈、变被动为主动。随后乘虚西进云南、巧渡金沙江，把数十万追敌永远甩在身后。',
    start: '1935-01-19',
    end: '1935-04-05',
    region: { lonMin: 104.4, lonMax: 108.6, latMin: 26.2, latMax: 29.4 },
    red: [
      {
        id: 'main', label: '中央红军', color: 0xe8402f, glow: 0xff6a4d,
        points: [
          ['1935-01-19', 106.93, 27.73], ['1935-01-24', 106.30, 28.25],
          ['1935-01-28', 105.92, 28.40], ['1935-01-29', 105.72, 28.30],
          ['1935-02-02', 105.35, 28.05], ['1935-02-06', 105.05, 27.85],
          ['1935-02-11', 105.45, 27.95], ['1935-02-18', 106.10, 28.10],
          ['1935-02-24', 106.83, 28.13], ['1935-02-26', 106.85, 28.00],
          ['1935-02-28', 106.93, 27.73], ['1935-03-05', 106.60, 27.65],
          ['1935-03-10', 106.40, 27.60], ['1935-03-16', 106.35, 27.85],
          ['1935-03-18', 105.95, 28.00], ['1935-03-21', 106.12, 28.08],
          ['1935-03-25', 106.55, 27.70], ['1935-03-31', 106.75, 27.25],
          ['1935-04-02', 106.70, 26.85], ['1935-04-05', 106.63, 26.65],
        ],
      },
    ],
    enemy: [
      { id: 'c-guo', label: '川军郭勋祺·土城', force: '川军', kind: 'pursue', from: [106.2, 28.6], to: [105.92, 28.40], start: '1935-01-25', end: '1935-02-06', note: '青杠坡越打越多，红军果断撤出。' },
      { id: 'c-pan', label: '川军潘文华·赤水河', force: '川军', kind: 'block', from: [105.44, 28.87], to: [105.8, 28.4], start: '1935-01-20', end: '1935-02-12', note: '长江南岸筑碉防堵。' },
      { id: 'c-liu', label: '川军刘湘·长江防线', force: '川军', kind: 'block', from: [104.62, 28.76], to: [105.5, 28.6], start: '1935-01-25', end: '1935-03-20', note: '重兵扼守长江，拒红军北渡。' },
      { id: 'z-wu', label: '中央军吴奇伟·援遵义', force: '中央军', kind: 'pursue', from: [106.63, 26.65], to: [106.93, 27.73], start: '1935-02-20', end: '1935-03-06', note: '二渡后回师黔北，吴奇伟纵队被歼大部。' },
      { id: 'z-zhou', label: '中央军周浑元·鲁班场', force: '中央军', kind: 'block', from: [106.2, 27.2], to: [106.5, 27.6], start: '1935-03-01', end: '1935-03-22', note: '筑碉固守，红军攻而不克后三渡赤水。' },
      { id: 'q-wang', label: '黔军王家烈·乌江', force: '黔军', kind: 'block', from: [106.63, 26.65], to: [106.75, 27.25], start: '1935-03-20', end: '1935-04-05', note: '乌江防线，"双枪兵"一触即溃。' },
      { id: 'd-sun', label: '滇军孙渡·被调贵阳', force: '滇军', kind: 'pursue', from: [104.6, 26.4], to: [106.63, 26.65], start: '1935-04-01', end: '1935-04-10', note: '蒋介石急调滇军保驾，云南门户洞开。' },
    ],
    ring: { center: [106.2, 27.9], radiusStart: 2.1, radiusEnd: 0.8, start: '1935-01-25', end: '1935-03-20', label: '敌合围圈' },
    events: [
      { id: 'b-tucheng', date: '1935-01-28', lon: 105.92, lat: 28.40, name: '土城战役', type: 'battle', place: '贵州习水土城', summary: '青杠坡与川军郭勋祺部激战，情报有误、敌越打越多，陷入僵局。', result: '歼敌一部后主动撤出，伤亡约2000人；毛泽东果断放弃北渡长江，西渡赤水。', significance: '四渡赤水的起点：由被动转向机动。' },
      { id: 'b-cs1', date: '1935-01-29', lon: 105.72, lat: 28.30, name: '一渡赤水', type: 'crossing', place: '土城、元厚', summary: '分三路西渡赤水河，进入川南古蔺、叙永。', result: '摆脱当面川军，暂避锋芒；敌主力被引向川南。', significance: '第一笔：避实。' },
      { id: 'b-zhaxi', date: '1935-02-06', lon: 105.05, lat: 27.85, name: '扎西整编', type: 'meeting', place: '云南威信扎西', summary: '部队缩编为17个团，精简机关、轻装前进。', result: '战斗力凝练，为回师黔北创造条件。', significance: '敌以为红军将北渡长江，重兵西集。' },
      { id: 'b-cs2', date: '1935-02-18', lon: 106.10, lat: 28.10, name: '二渡赤水', type: 'crossing', place: '太平渡、二郎滩', summary: '突然掉头东进，二渡赤水，杀回兵力空虚的黔北。', result: '跳出川军合围，直扑桐梓、娄山关、遵义。', significance: '第二笔：击虚，完全出乎蒋介石意料。' },
      { id: 'b-loushan', date: '1935-02-26', lon: 106.85, lat: 28.00, name: '娄山关大捷', type: 'battle', place: '贵州娄山关', summary: '红三军团仰攻"一夫当关"的娄山关，反复肉搏夺关。', result: '歼灭黔军两个团大部，夺占天险。', significance: '"雄关漫道真如铁，而今迈步从头越。"' },
      { id: 'b-zunyi2', date: '1935-02-28', lon: 106.93, lat: 27.73, name: '再占遵义', type: 'battle', place: '贵州遵义', summary: '乘胜再占遵义，击溃中央军吴奇伟纵队两个师大部。', result: '五天连下桐梓、娄山关、遵义，歼敌2个师又8个团，俘敌约3000人。', significance: '长征以来最大一次胜利，士气大振。' },
      { id: 'b-cs3', date: '1935-03-16', lon: 106.35, lat: 27.85, name: '三渡赤水', type: 'crossing', place: '茅台', summary: '茅台西渡赤水，再入川南，佯作北渡长江姿态。', result: '蒋介石急令各路大军向川南集结，企图聚歼红军于古蔺。', significance: '第三笔：调敌，把敌主力引向赤水河以西。' },
      { id: 'b-cs4', date: '1935-03-21', lon: 106.12, lat: 28.08, name: '四渡赤水', type: 'crossing', place: '二郎滩、九溪口、太平渡', summary: '秘密、迅速东渡赤水，折返黔北，把数十万敌军甩在赤水河西岸。', result: '跳出敌人重兵包围圈，随即南渡乌江。', significance: '第四笔：脱围，运动战的神来之笔。' },
      { id: 'b-wujiang', date: '1935-03-31', lon: 106.75, lat: 27.25, name: '南渡乌江', type: 'crossing', place: '贵州乌江渡口', summary: '南渡乌江，兵锋直指贵阳。', result: '把追敌全部甩在乌江以北，包围圈彻底失效。', significance: '合围被撕开，红军获得主动。' },
      { id: 'b-guiyang', date: '1935-04-02', lon: 106.70, lat: 26.85, name: '佯攻贵阳', type: 'march', place: '贵州贵阳', summary: '直逼贵阳，正在督战的蒋介石急调滇军孙渡纵队"保驾"。', result: '滇军被调出云南，红军乘虚疾进云南，"调出滇军就是胜利"。', significance: '为巧渡金沙江铺平道路。' },
    ],
    steps: [
      { date: '1935-01-19', title: '离开遵义北上', text: '遵义会议后红军北上，计划北渡长江与红四方面军会合。蒋介石调川军重兵扼守长江，布下口袋。' },
      { date: '1935-01-28', title: '土城受挫', text: '青杠坡川军郭勋祺部越打越多，战斗陷入僵局。毛泽东果断撤出战斗，放弃北渡长江——不打硬仗，走！' },
      { date: '1935-01-29', title: '一渡赤水·避实', text: '西渡赤水入川南。敌以为红军要北渡长江，急调主力向川南集结，包围圈开始向西转动。' },
      { date: '1935-02-06', title: '扎西整编', text: '部队缩编轻装。此时黔北兵力空虚——敌人的重兵都被吸到了川南。机会来了。' },
      { date: '1935-02-18', title: '二渡赤水·击虚', text: '突然掉头东进，二渡赤水杀回黔北！完全出乎蒋介石意料，桐梓、娄山关、遵义门户洞开。' },
      { date: '1935-02-26', title: '娄山关大捷', text: '仰攻天险娄山关，反复肉搏夺关。"雄关漫道真如铁，而今迈步从头越。"' },
      { date: '1935-02-28', title: '再占遵义', text: '五天连下三城，歼敌2个师又8个团、俘敌3000——长征以来最大胜利。蒋介石急调吴奇伟、周浑元回援。' },
      { date: '1935-03-16', title: '三渡赤水·调敌', text: '茅台西渡，佯作北渡长江。蒋介石果然上当，令各路大军向川南合围，企图聚歼红军于古蔺。' },
      { date: '1935-03-21', title: '四渡赤水·脱围', text: '秘密东渡！把数十万敌军甩在赤水河西岸。敌人在川南扑了个空，包围圈被彻底甩在身后。' },
      { date: '1935-03-31', title: '南渡乌江', text: '南渡乌江，兵锋直指贵阳。追敌全部被甩在乌江以北，合围失效。' },
      { date: '1935-04-02', title: '佯攻贵阳·调滇军', text: '蒋介石在贵阳急调滇军"保驾"。滇军一出云南，金沙江门户洞开——下一步，巧渡金沙江。' },
      { date: '1935-04-05', title: '乘虚西进·下一幕金沙江', text: '滇军被调出云南，金沙江防务空虚。红军乘虚西进——下一幕：巧渡金沙江，彻底摆脱数十万追敌。本战役到此收束。' },
    ],
  },
  {
    id: 'xiangjiang',
    name: '湘江战役',
    subtitle: '1934.11 — 1934.12 · 最惨烈一战',
    intro: '蒋介石布第四道封锁线，湘军、桂军、中央军三面合围湘江走廊。红军血战五昼夜掩护中央纵队渡江，付出8.6万→3万的惨痛代价。',
    conclusion: '湘江战役突破第四道封锁线，但中央红军由8.6万锐减至3万余。惨痛代价宣告"左"倾错误路线破产，全军上下强烈要求改变领导——伟大转折的序幕由此拉开：通道转兵、黎平会议，直至遵义会议。',
    start: '1934-11-25',
    end: '1934-12-03',
    region: { lonMin: 109.6, lonMax: 112.6, latMin: 24.8, latMax: 26.8 },
    red: [
      {
        id: 'main', label: '中央红军', color: 0xe8402f, glow: 0xff6a4d,
        points: [
          ['1934-11-25', 111.60, 25.53], ['1934-11-27', 111.15, 25.49],
          ['1934-11-28', 110.85, 25.85], ['1934-12-01', 110.65, 26.05],
          ['1934-12-03', 110.20, 26.10],
        ],
      },
    ],
    enemy: [
      { id: 'x-liu', label: '湘军刘建绪·全州', force: '湘军', kind: 'block', from: [112.6, 26.9], to: [111.07, 25.93], start: '1934-11-20', end: '1934-12-02', note: '自衡阳、全州南下，封锁湘江渡口。' },
      { id: 'x-xia', label: '桂军夏威·兴安', force: '桂军', kind: 'block', from: [110.29, 25.27], to: [110.67, 25.61], start: '1934-11-22', end: '1934-12-02', note: '自桂林、兴安北上，夹击湘江走廊。' },
      { id: 'x-zhou', label: '中央军周浑元·尾追', force: '中央军', kind: 'pursue', from: [112.4, 25.6], to: [111.6, 25.53], start: '1934-11-20', end: '1934-12-05', note: '尾追红军，压缩渡江时间。' },
      { id: 'x-wu', label: '中央军吴奇伟·侧压', force: '中央军', kind: 'pursue', from: [112.0, 26.4], to: [111.2, 26.0], start: '1934-11-24', end: '1934-12-03', note: '自北向南侧压湘江走廊。' },
    ],
    ring: { center: [110.95, 25.8], radiusStart: 1.5, radiusEnd: 0.45, start: '1934-11-25', end: '1934-12-01', label: '敌合围圈' },
    events: [
      { id: 'x-block4', date: '1934-11-25', lon: 111.30, lat: 25.75, name: '第四道封锁线', type: 'battle', place: '湘桂边境', summary: '蒋介石判明红军西进意图，调湘军、桂军、中央军约40万，在湘江布第四道封锁线。', result: '三面合围湘江走廊，企图聚歼红军于湘江以东。', significance: '长征中最危险的包围圈。' },
      { id: 'x-battle', date: '1934-11-27', endDate: '1934-12-01', lon: 111.05, lat: 25.92, name: '湘江血战', type: 'battle', place: '兴安、全州、灌阳', summary: '觉山铺、新圩、光华铺三大阻击战，血战五昼夜掩护中央纵队渡江。红34师陈树湘断后，全师几乎覆没。', result: '突破第四道封锁线，但中央红军由8.6万锐减至3万余人。', significance: '"三年不饮湘江水，十年不食湘江鱼。"惨痛代价宣告"左"倾路线破产。' },
      { id: 'x-cross', date: '1934-12-01', lon: 110.85, lat: 25.85, name: '渡过湘江', type: 'crossing', place: '界首渡口', summary: '中央纵队与主力最后渡过湘江，跳出合围。', result: '红军渡江成功，但付出惨重代价。', significance: '渡江后全军强烈要求改变领导，为遵义会议埋下伏笔。' },
    ],
    steps: [
      { date: '1934-11-25', title: '第四道封锁线', text: '蒋介石调湘军、桂军、中央军约40万，在湘江布下第四道封锁线，三面合围，企图聚歼红军于湘江以东。' },
      { date: '1934-11-27', title: '三大阻击战', text: '觉山铺、新圩、光华铺同时打响。红军以血肉之躯顶住三面进攻，为中央纵队争取渡江时间。' },
      { date: '1934-11-29', title: '陈树湘断后', text: '红34师师长陈树湘率部殿后，被截断在湘江以东，全师几乎覆没。陈树湘负伤被俘后绞肠明志，年仅29岁。' },
      { date: '1934-12-01', title: '渡过湘江', text: '中央纵队与主力最后渡过湘江，跳出合围。但出发时的8.6万人，只剩3万余。' },
      { date: '1934-12-02', title: '惨痛的代价', text: '"三年不饮湘江水，十年不食湘江鱼。"惨痛代价宣告"左"倾错误路线破产，全军上下强烈要求改变领导——转折已在路上。' },
      { date: '1934-12-03', title: '西进贵州·转折在路上', text: '渡过湘江后红军西进贵州。惨痛代价催生伟大转折：通道转兵、黎平会议，直至遵义会议。本战役到此收束。' },
    ],
  },
];

export const battleById = (id: string): Battle | undefined => BATTLES.find((b) => b.id === id);