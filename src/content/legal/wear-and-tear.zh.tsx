const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[14.5px] text-muted leading-[1.8] mb-4">{children}</p>
)
const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-5 space-y-2 text-[14px] text-muted mb-4">{children}</ul>
)
const LI = ({ children }: { children: React.ReactNode }) => (
  <li className="leading-relaxed">{children}</li>
)
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-syne font-bold text-[15px] text-navy mt-6 mb-2">{children}</h3>
)
const Highlight = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-orange/[0.06] border-l-[3px] border-orange rounded-r-lg px-4 py-3 mb-4 text-[13.5px] text-navy leading-relaxed">
    {children}
  </div>
)

const CompareTable = ({
  rows,
}: {
  rows: { item: string; fairWear: string; damage: string }[]
}) => (
  <div className="overflow-x-auto mb-4">
    <table className="w-full text-[13px]">
      <thead>
        <tr className="bg-navy text-white">
          <th className="text-left px-4 py-2.5 font-syne font-bold rounded-tl-lg">项目</th>
          <th className="text-left px-4 py-2.5 font-syne font-bold text-green-300">合理磨损</th>
          <th className="text-left px-4 py-2.5 font-syne font-bold text-orange rounded-tr-lg">需收费损坏</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-off-white' : 'bg-white'}>
            <td className="px-4 py-2.5 text-navy font-medium">{r.item}</td>
            <td className="px-4 py-2.5 text-muted">{r.fairWear}</td>
            <td className="px-4 py-2.5 text-muted">{r.damage}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const zhWearAndTearToc = [
  { id: 'what-is', label: '什么是合理磨损？' },
  { id: 'comparison', label: '合理磨损与收费损坏对照' },
  { id: 'exterior', label: '外观标准' },
  { id: 'interior', label: '内饰标准' },
  { id: 'mechanical', label: '机械与轮胎' },
  { id: 'assessment', label: '评估流程' },
  { id: 'dispute', label: '争议处理' },
]

export const zhWearAndTearSections = [
  {
    id: 'what-is',
    title: '什么是合理磨损？',
    content: (
      <>
        <P>
          合理磨损是指车辆在正常、日常使用过程中自然产生的轻微老化或损耗。即便承租人已尽到合理注意义务，车辆状态仍可能随着时间出现一定程度的自然下降。
        </P>
        <P>
          YITU 理解在租赁期间会出现某些轻微且不可避免的磨损。凡属于合理磨损范围内的情况，我们不会向您收费。
        </P>
        <Highlight>
          <strong>核心原则：</strong>如果还车时车辆状况符合根据正常使用方式与租期长度所能合理预期的状态，则不收取费用。
        </Highlight>
        <P>
          与之相对，超出正常使用预期的损失或恶化，例如划痕、凹陷、污渍、烧痕或因不当使用导致的机械损伤，则属于需收费的损坏。
        </P>
      </>
    ),
  },
  {
    id: 'comparison',
    title: '合理磨损与收费损坏对照',
    content: (
      <>
        <P>
          下表可帮助您理解“合理磨损（不收费）”与“需收费损坏”的一般区别。
        </P>
        <CompareTable
          rows={[
            {
              item: '车漆 / 车身',
              fairWear: '正常洗车产生的极细微旋纹；老车轻微表面氧化',
              damage: '划痕穿透清漆或车漆；大于 5 毫米的石击点；凹陷或折痕',
            },
            {
              item: '前挡风玻璃',
              fairWear: '不影响视线的轻微砂点或表面细痕',
              damage: '驾驶员视线范围内任何尺寸的裂纹、缺口或星形裂痕',
            },
            {
              item: '其他玻璃',
              fairWear: '非常轻微的表面痕迹',
              damage: '侧窗、后窗或后视镜的任何裂缝、缺口或破损',
            },
            {
              item: '轮胎',
              fairWear: '在铺装道路正常驾驶造成的正常胎纹磨损',
              damage: '胎壁割伤、鼓包、穿刺、蹭路肩或越野驾驶导致的损坏',
            },
            {
              item: '座椅与内饰面料',
              fairWear: '正常使用造成的轻微污迹与细小磨痕',
              damage: '污渍、烧痕、撕裂、割裂、需专业清洁的宠物毛发',
            },
            {
              item: '地毯 / 地板',
              fairWear: '鞋履带来的轻微灰尘与脏污',
              damage: '严重泥沙、泥巴或污渍，需专业清洁',
            },
            {
              item: '仪表台 / 饰板',
              fairWear: '可清除的轻微灰尘与指纹',
              damage: '划伤、凿痕、破裂面板或断裂卡扣',
            },
          ]}
        />
      </>
    ),
  },
  {
    id: 'exterior',
    title: '外观标准',
    content: (
      <>
        <H3>车漆</H3>
        <P>
          因正常清洗和护理产生的轻微表面旋纹属于可接受范围。若划痕穿透清漆进入色漆或底漆层、石击点直径超过 5 毫米，或出现任何凹陷、折痕或板件变形，则不属于合理磨损。
        </P>
        <H3>挡风玻璃与车窗</H3>
        <P>
          外表面因道路碎屑造成的轻微砂点可视为合理磨损。任何出现在驾驶员视线区域内或附近的裂纹或缺口，不论大小，均视为损坏，必须立即报告。
        </P>
        <H3>保险杠与饰件</H3>
        <UL>
          <LI>轻微停车擦痕且可抛光去除：属于合理磨损</LI>
          <LI>裂开、断裂、深度刮伤或饰件缺失：属于收费损坏</LI>
          <LI>嵌入保险杠的雷达、摄像头或泊车辅助装置受损：属于收费损坏</LI>
        </UL>
        <Highlight>
          如您在提车时已发现车辆存在损伤，请立即告知 YITU 工作人员并记录在租赁文件上。若未报告的既有损坏在还车时才被发现，可能会被视为由您造成。
        </Highlight>
      </>
    ),
  },
  {
    id: 'interior',
    title: '内饰标准',
    content: (
      <>
        <H3>座椅与织物</H3>
        <P>
          车辆随着使用年限出现轻微塌陷或轻微褪色，属于合理磨损。食物、饮料、墨水、生物性污渍，香烟或热源烧痕，割裂、撕裂，以及宠物毛发等，均属于收费损坏。
        </P>
        <H3>异味</H3>
        <P>
          如车辆归还时存在烟味或其他持续性强烈异味，可能产生专业除味费用。YITU 所有车辆严禁吸烟。
        </P>
        <H3>清洁程度</H3>
        <UL>
          <LI>日常使用带来的轻微灰尘与污垢：可接受</LI>
          <LI>大量泥沙、沙粒、食物残渣等需专业清洁：将收取清洁费用</LI>
          <LI>任何生物性污染：将收取专业清洁费用</LI>
        </UL>
        <H3>仪表台、控制件与电子设备</H3>
        <P>
          归还时，所有仪表控制、屏幕和电子系统均应保持正常工作状态。若饰板划伤、卡扣断裂、屏幕开裂或控制失灵，且并非提车时已记录的既有损坏，则属于收费损坏。
        </P>
      </>
    ),
  },
  {
    id: 'mechanical',
    title: '机械与轮胎',
    content: (
      <>
        <H3>轮胎</H3>
        <P>
          在铺装道路上正常驾驶导致的胎纹逐渐磨损，属于合理磨损。以下情况则属于收费损坏：
        </P>
        <UL>
          <LI>因撞击路肩或粗糙地面导致的胎壁损伤或鼓包</LI>
          <LI>被异物刺穿造成的破胎</LI>
          <LI>因胎压不足继续行驶或撞击造成的爆胎 / 扁胎损坏</LI>
          <LI>因在未铺装或禁止通行路面驾驶导致的损坏</LI>
        </UL>
        <H3>机械系统</H3>
        <P>
          在正常使用过程中，由车辆本身机械缺陷引起的故障由 YITU 承担，不向您收费。但因误用造成的机械损坏，例如超载、涉水、未经授权拖拽、加错油等，属于收费损坏，且可能不受任何损失豁免保障。
        </P>
        <Highlight>
          <strong>加错油：</strong>若车辆加入错误燃油，您需承担排空油路及修复燃油系统的全部相关费用，此类损失不受任何豁免产品保障。
        </Highlight>
      </>
    ),
  },
  {
    id: 'assessment',
    title: '评估流程',
    content: (
      <>
        <P>
          车辆归还时，YITU 工作人员会在可能的情况下与您一同进行环车检查。我们强烈建议您在场，以便现场解决任何疑问。
        </P>
        <H3>如何评估损坏</H3>
        <UL>
          <LI>轻微损坏可能依据标准化维修费用表进行评估</LI>
          <LI>较严重的损坏将由独立维修商或钣喷厂评估</LI>
          <LI>如您提出要求，可获得书面的损坏评估报告</LI>
          <LI>车辆维修期间造成的营业损失可能向您收取，详见《条款与条件》第 5.6 条</LI>
        </UL>
        <H3>既有损坏</H3>
        <P>
          所有既有损坏都会在提车时记录于您的租赁文件中。请仔细核对，并在签字前确保任何未记载的损坏都已补充记录。既有损坏不会在还车时向您收费。
        </P>
        <H3>非营业时间还车</H3>
        <P>
          如果您在非营业时间归还车辆，YITU 将在下一个工作日完成检查。建议您在还车时拍摄车辆照片，作为个人留存记录。
        </P>
      </>
    ),
  },
  {
    id: 'dispute',
    title: '争议处理',
    content: (
      <>
        <P>
          如果您不同意损坏评估结果，您有权提出争议。请在收到收费通知后的 5 个工作日内联系我们。
        </P>
        <UL>
          <LI>请将书面争议发送至 <a href="mailto:yitucars@hotmail.com" className="text-orange hover:underline">yitucars@hotmail.com</a></LI>
          <LI>请附上您的租赁协议编号、租赁日期以及争议理由</LI>
          <LI>请一并提交您在提车或还车时拍摄的照片或其他证据</LI>
        </UL>
        <P>
          YITU 将在 15 个工作日内审查您的争议并以书面形式回复。如您对结果仍不满意，可将事项升级提交给新西兰租赁车辆协会。
        </P>
        <Highlight>
          我们建议您在提车和还车时都拍摄带日期的车辆全景照片，包括四个角、车顶、内饰及所有玻璃部位。这既保护您，也保护 YITU，并可使后续争议更容易处理。
        </Highlight>
      </>
    ),
  },
]
