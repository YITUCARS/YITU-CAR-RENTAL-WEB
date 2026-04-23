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
const PriceTable = ({ rows }: { rows: { fee: string; rate: string; clause: string }[] }) => (
  <div className="overflow-x-auto mb-4">
    <table className="w-full text-[13px]">
      <thead>
        <tr className="bg-navy text-white">
          <th className="text-left px-4 py-2.5 font-syne font-bold rounded-tl-lg">费用项目</th>
          <th className="text-left px-4 py-2.5 font-syne font-bold">费率（含 GST）</th>
          <th className="text-left px-4 py-2.5 font-syne font-bold rounded-tr-lg">条款</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-off-white' : 'bg-white'}>
            <td className="px-4 py-2.5 text-navy font-medium">{r.fee}</td>
            <td className="px-4 py-2.5 text-muted">{r.rate}</td>
            <td className="px-4 py-2.5 text-muted">{r.clause}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const zhTermsToc = [
  { id: 'contact-details', label: '联系方式' },
  { id: 'understanding', label: '1. 了解您的租赁协议' },
  { id: 'driver', label: '2. 驾驶员' },
  { id: 'where-to-drive', label: '3. 车辆可驾驶与禁止驾驶区域' },
  { id: 'vehicle-maintenance', label: '4. 车辆保养、安全与清洁' },
  { id: 'return', label: '5. 车辆归还' },
  { id: 'fuel', label: '6. 燃油' },
  { id: 'liability', label: '7. 损失或损坏责任' },
  { id: 'ldw', label: '8. 损失及损坏豁免' },
  { id: 'snow', label: '9. 雪地驾驶' },
  { id: 'assessment', label: '10. 损失或损坏的评估与付款' },
  { id: 'claims', label: '11. 索赔与事故处理' },
  { id: 'payment', label: '12. 付款' },
  { id: 'termination', label: '13. 终止' },
  { id: 'dispute', label: '15. 争议解决' },
  { id: 'nz-consumer', label: '16. 新西兰消费者法' },
  { id: 'pricing-schedule', label: '附件 B：价格表' },
  { id: 'ev-terms', label: '附件 C：电动车条款' },
  { id: 'pay-now', label: '附件 D：立即支付条款' },
]

export const zhTermsSections = [
  {
    id: 'contact-details',
    title: '联系方式',
    content: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: '预订', email: 'booking@yiturentalcars.co.nz', phone: '0800 948 888' },
          { label: '道路救援', email: null, phone: '0800 948 888', iPhone: '0800 734 543' },
          { label: '客户服务', email: 'yitucars@hotmail.com', phone: '0800 948 888' },
          { label: '理赔', email: 'jay@yitugroup.co.nz', phone: '+64 21 873789' },
        ].map((c) => (
          <div key={c.label} className="bg-off-white border border-black/10 rounded-[10px] p-4">
            <div className="font-syne font-bold text-[13px] text-navy mb-2">{c.label}</div>
            {c.email && <a href={`mailto:${c.email}`} className="block text-[12.5px] text-orange hover:underline mb-1">{c.email}</a>}
            <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="block text-[12.5px] text-muted hover:text-orange mb-1">{c.phone}</a>
            {c.iPhone && <a href={`tel:${c.iPhone.replace(/\s/g, '')}`} className="text-[12.5px] text-muted hover:text-orange">{c.iPhone}</a>}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'understanding',
    title: '1. 了解您的租赁协议',
    content: (
      <>
        <P>
          您与 YITU 就车辆签订的租赁协议，以租赁文件上所列日期为准成立。该协议载明了您在租车及选择可选附加服务时对 YITU 的责任，以及 YITU 对您的责任。
        </P>
        <P>
          当您在提车时签署租赁文件后，租赁协议即对双方具有法律约束力。
        </P>
        <Highlight>
          一旦您签订租赁协议，即表示您同意受本条款与条件、《隐私声明》（附件 A）、《价格表》（附件 B）、《电动车条款与条件》（附件 C）以及在适用时《立即支付条款与条件》（附件 D）的约束。
        </Highlight>
        <H3>您同意的事项</H3>
        <UL>
          <LI>在约定的租赁期间内租用租赁协议所列车辆</LI>
          <LI>支付租赁协议中列明的所有应付款项</LI>
          <LI>如延长租期，支付相应的额外租金</LI>
          <LI>支付行政费用、罚金、通行费、停车费、损失或损坏费用以及其他相关收费</LI>
        </UL>
        <H3>附加驾驶员</H3>
        <P>
          只有您本人及经授权的附加驾驶员才可以驾驶车辆。您有责任确保所有附加驾驶员均遵守租赁协议。每位附加驾驶员可能会产生额外费用。
        </P>
      </>
    ),
  },
  {
    id: 'driver',
    title: '2. 驾驶员',
    content: (
      <>
        <P>您同意并确认：</P>
        <UL>
          <LI>只有授权驾驶员可以驾驶车辆</LI>
          <LI>所有授权驾驶员必须持有当前有效驾照，并在签署租赁文件前已连续至少 12 个月持有同类别车辆驾驶资格</LI>
          <LI>您及附加驾驶员授权 YITU 向有关机构核验您的驾照状态、资料及记录</LI>
        </UL>
        <Highlight>
          如果您或附加驾驶员未持有有效驾照、存在驾驶相关违法记录，或未通过 YITU 合理要求的身份、安全或信用核验，YITU 有权拒绝您驾驶车辆。
        </Highlight>
      </>
    ),
  },
  {
    id: 'where-to-drive',
    title: '3. 车辆可驾驶与禁止驾驶区域',
    content: (
      <>
        <P>授权驾驶员只能在已形成、已建设完成并适合通行的柏油路、碎石路或金属路面上驾驶车辆。</P>
        <H3>禁止使用情形</H3>
        <P>授权驾驶员不得在以下地点或情况下驾驶车辆：</P>
        <UL>
          <LI>海滩、沙地或溪流中</LI>
          <LI>河流、洪水或积水路段中</LI>
          <LI>消防通道或越野小路上</LI>
          <LI>未使用雪链的雪地路面</LI>
          <LI>机场空侧区域，除非事先获得 YITU 书面授权</LI>
        </UL>
        <H3>其他未经授权的使用</H3>
        <P>授权驾驶员不得：</P>
        <UL>
          <LI>将车辆用于任何违法目的、比赛、竞赛或性能测试</LI>
          <LI>搭载超过安全带数量允许的乘客</LI>
          <LI>酒后或药物影响下驾驶</LI>
          <LI>以收费方式运送乘客</LI>
          <LI>在车内吸烟，或允许任何人在车内吸烟</LI>
          <LI>使用车辆协助任何犯罪或恐怖主义行为</LI>
          <LI>逃避支付通行费、停车费、清洁费、罚款或违章费用</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'vehicle-maintenance',
    title: '4. 车辆保养、安全与清洁',
    content: (
      <>
        <P>所有授权驾驶员必须：</P>
        <UL>
          <LI>按照制造商规范维持发动机机油和冷却液液位</LI>
          <LI>在车辆无人看管时确保车门锁好，并合理保管钥匙</LI>
          <LI>遵守所有适用的安全带及儿童安全座椅法律要求</LI>
        </UL>
        <H3>道路救援</H3>
        <P>
          对于车辆自身机械故障，YITU 提供 24 小时道路救援且不额外收费。但如果救援是因您的行为或疏忽所致，例如紧急送油、轮胎损坏、钥匙遗失、钥匙锁车内或因忘记关灯导致电瓶亏电，您需支付每次道路救援出车费用。
        </P>
        <H3>清洁</H3>
        <P>
          如果 YITU 有合理理由认为您归还车辆时车辆状况较差（不包括合理磨损），或租赁期间曾在车内吸烟，您可能需要承担专业清洁或异味去除费用。
        </P>
      </>
    ),
  },
  {
    id: 'return',
    title: '5. 车辆归还',
    content: (
      <>
        <P>您必须在租赁文件所列地点、日期及时间归还车辆，并使车辆状态与租赁开始时基本一致（合理磨损除外）。</P>
        <Highlight>
          <strong>重要提示：</strong>如未经事先批准将车辆归还至不同地点，可能会收取每公里 $2.30 的单程费。如逾期归还，则每小时收取 $30.00 的迟还费用。
        </Highlight>
        <H3>提前归还</H3>
        <P>
          如果您比约定时间更早归还车辆，租赁文件上的价格可能不再适用，您需按该租期对应的现行日租金结算，而该价格可能更高。
        </P>
        <H3>车辆停运损失</H3>
        <P>
          如果因您违反租赁协议导致车辆停运，您可能需要按车辆实际停运天数支付相应的营业损失费用。
        </P>
      </>
    ),
  },
  {
    id: 'fuel',
    title: '6. 燃油',
    content: (
      <>
        <P>您必须仅按照制造商规定为车辆加注正确类型的燃油。</P>
        <H3>行驶少于 120 公里时的加油规则</H3>
        <P>
          若您在租赁期间行驶少于 120 公里，YITU 可按每公里燃油服务费向您收费。如您能提供收车前已将油量加回至与提车时相同水平的收据，YITU 可免除此项费用。
        </P>
        <H3>行驶 120 公里或以上时的加油规则</H3>
        <P>
          若您行驶达到或超过 120 公里，并在归还时油量低于提车时水平，您必须按租赁文件所列每升燃油服务费向 YITU 支付差额。
        </P>
      </>
    ),
  },
  {
    id: 'liability',
    title: '7. 损失或损坏责任',
    content: (
      <>
        <P>
          在适用的损失及损坏豁免范围之外，如 YITU 有合理理由认为车辆在租赁期间发生损坏、灭失或被盗，包括冰雹、洪水、暴风雨相关损坏，您需向 YITU 赔偿。
        </P>
        <H3>您无需承担责任的情形</H3>
        <P>
          如果 YITU 认可该损失或损坏并非由您造成，且您遵守了第 11 条事故处理流程、您为新西兰居民并向 YITU 提供了事故所需全部信息，则您无需向 YITU 赔偿。
        </P>
        <H3>YITU 需承担责任的情形</H3>
        <P>
          如车辆损坏或损失系 YITU 过错造成，包括 YITU 未妥善维护车辆，相关责任由 YITU 承担。
        </P>
      </>
    ),
  },
  {
    id: 'ldw',
    title: '8. 损失及损坏豁免（“基础保险”或 “YITU SUPER COVER”）',
    content: (
      <>
        <P>
          如根据第 7.1 条您本应向 YITU 赔偿损失，且您遵守了租赁协议并支付相应自负额，则 YITU 可豁免该责任。基础保险自负额为标准车型 $4,500、豪华车型 $5,000；YITU Super Cover 为零自负额。
        </P>
        <H3>损失及损坏豁免不适用的情形</H3>
        <P>以下损失不适用豁免：</P>
        <UL>
          <LI>车顶或底盘损坏，例如碰撞桥梁、隧道、树枝、停车场栏杆，或高速压过路缘、排水沟造成的损坏</LI>
          <LI>因驶入洪水、溪流或河流导致的涉水损坏</LI>
          <LI>因违反允许使用条款而造成的损坏</LI>
          <LI>车辆被盗（除非车辆找回且您的责任金额更低）</LI>
          <LI>故意或鲁莽行为导致的损坏或损失</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'snow',
    title: '9. 雪地驾驶',
    content: (
      <>
        <P>
          虽然一般规则禁止在雪地驾驶，但如果您使用了适合该车辆且由 YITU 提供或经 YITU 批准的装备（例如雪链），并且在当时环境下雪地驾驶本身属于合理且安全的行为，则允许您在雪地中驾驶。
        </P>
        <P>
          提车门店可能提供滑雪设备租赁作为附加服务，但不保证一定有库存。您有责任按照制造商规定安全固定所有滑雪设备。
        </P>
      </>
    ),
  },
  {
    id: 'assessment',
    title: '10. 损失或损坏的评估与付款',
    content: (
      <>
        <P>
          如您在损失及损坏豁免下需要承担自负额、责任尚未确定但 YITU 有合理理由认为您存在过错，或您未提供所需信息，YITU 可从您的账户中扣取相应自负额。
        </P>
        <Highlight>
          <strong>示例：</strong>如果自负额为 $5,000，而车辆被盗后三天被找回，仅有 $100 的损坏，另外产生 $400 的追回费用，则您将获得 $4,500 退款。
        </Highlight>
        <P>
          如果您需要向 YITU 支付任何损失、损坏、维修、成本或费用，金额以“维修成本”与“损坏发生时车辆市值”两者中较低者为准。
        </P>
      </>
    ),
  },
  {
    id: 'claims',
    title: '11. 索赔与事故处理',
    content: (
      <>
        <P>如发生事故或事件，您或其他授权驾驶员必须：</P>
        <UL>
          <LI>在法律要求的情况下，立即向当地警方报案</LI>
          <LI>在 24 小时内以书面形式向 YITU 报告事故</LI>
          <LI>不要做出赔偿承诺、和解承诺、免责承诺或责任承认</LI>
          <LI>允许 YITU 或其保险人在您的名义下提起、抗辩或和解相关法律程序</LI>
          <LI>根据 YITU 的合理要求，提供额外陈述、资料与协助</LI>
        </UL>
        <Highlight>
          <strong>发生事故时：</strong>请保持冷静，并尽快通知 YITU。在安全条件允许的情况下，请拍摄事故现场及所有涉事车辆照片。若未遵循该流程，您可能需要对相关损失或损坏承担财务责任。
        </Highlight>
      </>
    ),
  },
  {
    id: 'payment',
    title: '12. 付款',
    content: (
      <>
        <P>租赁期结束时，您授权 YITU 从您的账户中扣款，用于支付全部租金、因您使用车辆而已产生或将产生的费用，以及根据租赁协议您合理应付给 YITU 的任何款项。</P>
        <H3>付款争议</H3>
        <P>
          您可在收到通知后的 5 个工作日内通过 yitucars@hotmail.com 提出争议。在通知期内，YITU 不会就争议金额从您的账户中扣款。
        </P>
        <H3>退款</H3>
        <P>
          YITU 目标是在退款到期后的 14 天内完成退款。若为信用卡退款，您的发卡机构可能还需要 7 至 10 个工作日完成处理。
        </P>
        <H3>刷卡附加费</H3>
        <P>Visa 与 MasterCard：2.9% · American Express：3.1%</P>
      </>
    ),
  },
  {
    id: 'termination',
    title: '13. 终止',
    content: (
      <>
        <P>如果一方违反租赁协议，另一方可随时终止该协议。</P>
        <P>如车辆因承租人责任事故而处于“无法驾驶”状态，或警方及其他监管机构要求 YITU 从您处收回车辆，YITU 可终止租赁协议。</P>
        <Highlight>
          在此类终止或收回车辆的情况下，承租人无权要求退还任何已支付的租车费用。
        </Highlight>
      </>
    ),
  },
  {
    id: 'dispute',
    title: '15. 争议解决',
    content: (
      <>
        <P>
          YITU 将尽最大努力在收到投诉后十五（15）个工作日内回复。您的投诉将由一位具备相应经验与权限、且并非原决定作出人的 YITU 代表进行审查。
        </P>
        <P>
          如果您不同意 YITU 内部争议处理结果，您可将事项提交至新西兰租赁车辆协会。YITU 将本着诚信参与该争议解决流程。
        </P>
      </>
    ),
  },
  {
    id: 'nz-consumer',
    title: '16. 新西兰消费者法',
    content: (
      <>
        <P>
          如本条款与条件中的任何内容构成对您在新西兰消费者法下不可被排除、限制或修改之权利或救济的排除、限制或修改，则该内容不适用。
        </P>
        <H3>重大瑕疵时您的权利</H3>
        <P>如服务存在重大瑕疵，您有权取消与我们的服务合同，并就未使用部分获得退款，或就价值降低部分获得赔偿。</P>
        <H3>其他瑕疵时您的权利</H3>
        <P>如商品或服务存在非重大瑕疵，您有权要求我们在合理时间内予以纠正。若未被及时纠正，您有权就商品获得退款，并取消服务合同及获得未使用部分的退款。</P>
      </>
    ),
  },
  {
    id: 'pricing-schedule',
    title: '附件 B：价格表',
    content: (
      <>
        <PriceTable rows={[
          { fee: '迟还费', rate: '$30.00/小时，或适用日租价', clause: '5.3' },
          { fee: '单程费', rate: '$2.30/公里', clause: '5.2' },
          { fee: '刷卡附加费（Visa/MC）', rate: '2.9%', clause: '12.1(d)' },
          { fee: '刷卡附加费（Amex）', rate: '3.1%', clause: '12.1(d)' },
          { fee: '追收费', rate: '$86.25 + 年息 10%', clause: '12.10' },
          { fee: '道路救援出车费', rate: '每次最低 $235.75', clause: '4.6' },
          { fee: '专业清洁', rate: '$28.75 行政费 + 清洁成本', clause: '4.9' },
          { fee: '电动车充电费（10%–90%）', rate: '$34.50', clause: '附件 C' },
          { fee: '电动车充电费（低于 10%）', rate: '$69.00', clause: '附件 C' },
          { fee: '附加驾驶员费', rate: '每位驾驶员每次租赁 $30', clause: '2.2' },
          { fee: '取消预订（提前 24 小时以上）', rate: '最高 $86.25', clause: '4.4' },
          { fee: '取消预订（不足 24 小时）', rate: '最高 $172.50', clause: '4.5' },
          { fee: '预授权冻结金额', rate: '标准车型 $4,500 / 豪华车型 $5,000', clause: '2.4' },
        ]} />
        <P>除另有说明外，所有金额均已包含 GST。所有租金及自负额以您的租赁文件所列内容为准。</P>
      </>
    ),
  },
  {
    id: 'ev-terms',
    title: '附件 C：电动车条款与条件',
    content: (
      <>
        <Highlight>
          <strong>警告：</strong>电动车电量耗尽可能对电池造成不可逆损坏，相关更换费用将由您承担。电动车不得驶入自动洗车机。
        </Highlight>
        <P>如果您向 YITU 租用电动车，您及任何授权驾驶员确认并同意：</P>
        <UL>
          <LI>YITU 交付电动车时电量至少为 90%，您归还时也必须达到相同或更高电量</LI>
          <LI>如归还时电量低于 90% 但高于 10%，收取 $34.50 的电动车充电费</LI>
          <LI>如归还时电量低于或等于 10%，收取 $69.00 的充电费</LI>
          <LI>充电线必须随车归还；如遗失或损坏，您需承担更换费用</LI>
          <LI>因电量耗尽或不当驾驶造成的电池损坏不受任何损失豁免保障</LI>
          <LI>如您登录了车机应用程序，租期结束时退出登录由您自行负责</LI>
          <LI>Tesla 超级充电产生的费用会回传给 YITU，您需承担这部分费用，且可能在归还后 30 天内补扣</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'pay-now',
    title: '附件 D：立即支付条款与条件',
    content: (
      <>
        <P>
          本《立即支付条款与条件》适用于在预订时即支付约定租赁期间及任何可选附加项目费用的订单。
        </P>
        <H3>预订条件</H3>
        <UL>
          <LI>预订文件中列明的授权驾驶员姓名必须与提车人姓名一致</LI>
          <LI>用于立即支付预订的信用卡或借记卡必须在提车时出示</LI>
          <LI>提车时将在您的账户上进行 $4,500（豪华车型为 $5,000）的预授权冻结</LI>
        </UL>
        <H3>取消政策</H3>
        <UL>
          <LI><strong>提前 24 小时以上：</strong>全额退款，但可能扣除最高 $86.25 的取消手续费</LI>
          <LI><strong>不足 24 小时：</strong>退款时可能扣除最高 $172.50 的取消手续费</LI>
          <LI><strong>未到店 / 未取消：</strong>已预付金额全部不退</LI>
        </UL>
        <P>所有退款申请必须在预定提车日期后的 90 天内提交。超过 90 天将不再受理退款。</P>
        <H3>修改预订</H3>
        <P>
          您可在提车日前随时致电 0800 948 888 联系预订部门，或通过 www.yiturentalcars.co.nz 在线管理预订以修改订单。
        </P>
        <Highlight>
          如果您在约定租期结束日前提前归还车辆，已预付费用中的任何部分均不予退还。此规定不影响您在新西兰消费者法下享有的法定权利。
        </Highlight>
      </>
    ),
  },
]
