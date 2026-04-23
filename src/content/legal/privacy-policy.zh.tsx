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

export const zhPrivacyToc = [
  { id: 'getting-started', label: '开始了解' },
  { id: 'renting', label: '租车时收集的信息' },
  { id: 'frequent-renter', label: '常客租车计划' },
  { id: 'coverage', label: '保障产品' },
  { id: 'vehicle-data', label: '车辆数据' },
  { id: 'online-data', label: '在线数据' },
  { id: 'online-advertising', label: '在线广告' },
  { id: 'marketing', label: '营销' },
  { id: 'information-sharing', label: '信息共享' },
  { id: 'your-choices', label: '您的选择' },
  { id: 'safeguards', label: '安全保障' },
  { id: 'retention', label: '信息保留' },
  { id: 'international', label: '国际传输' },
  { id: 'your-rights', label: '您的隐私权利' },
  { id: 'contact', label: '数据控制者与联系方式' },
]

export const zhPrivacySections = [
  {
    id: 'getting-started',
    title: '开始了解',
    content: (
      <>
        <P>
          欢迎阅读 YITU Group, Inc. 旗下 YITU New Zealand 的《隐私声明》（下文中的 “YITU”“我们”“本公司”均指这些公司）。请您认真阅读本声明，以便了解我们如何收集和使用您的个人信息。
        </P>
        <P>
          “个人信息”指与在世自然人有关、能够识别该个人或可被用于识别该个人的任何信息。
        </P>
        <P>
          我们可能会不时更新本隐私声明。如某项变更会对您的权利产生重大影响，我们将在变更生效前，通过网站显著公告、电子邮件和/或邮寄方式通知您。
        </P>
        <P>
          本隐私声明适用于 YITU 通过线上或线下方式，在您使用我们的产品与服务时所收集、使用及披露的个人信息。为向您提供租车服务及其他服务，YITU 需要向您收集一定的个人信息。
        </P>
      </>
    ),
  },
  {
    id: 'renting',
    title: '租车时收集的信息',
    content: (
      <>
        <P>
          当您预订车辆、租用车辆或加入我们的计划时，我们会为了向您提供服务及满足我们的合法商业目的而收集信息。收集的信息包括：
        </P>
        <UL>
          <LI>姓名与家庭住址（用于驾照核验与账单处理）</LI>
          <LI>电子邮箱地址（例如在线预订或申请电子收据时）</LI>
          <LI>可联系到您的电话号码</LI>
          <LI>出生日期与性别（用于驾照核验及法定要求）</LI>
          <LI>付款信息，例如信用卡或借记卡资料（安全码仅用于交易，不予保留）</LI>
          <LI>驾照及/或其他政府签发身份证明</LI>
          <LI>雇主资料及商业地址（如您参加企业计划）</LI>
          <LI>优惠码、合作伙伴会员号、协会会员信息</LI>
          <LI>特殊需求与偏好，包括损失豁免等可选附加项目</LI>
        </UL>
        <P>
          在租赁期间，我们还会收集您提车和还车的地点与时间、保障偏好、油耗、里程、事故记录以及其他与车辆及其使用有关的信息。
        </P>
        <P>
          对于您在租赁期间产生的超速、停车、通行费或其他交通相关罚单，以及执法机关提供给我们的交通违法信息，我们也可能会进行收集。
        </P>
      </>
    ),
  },
  {
    id: 'frequent-renter',
    title: '常客租车计划',
    content: (
      <>
        <P>
          如果您加入我们的常客租车计划，例如 YITU Preferred，我们会收集并保留您的姓名、联系方式、驾照信息及出生日期，以为您创建账户。
        </P>
        <P>
          我们将使用这些信息让您享受会员权益，例如门店快速办理、通过 App 自助处理部分租赁步骤，以及免费升级、免费租期等奖励。
        </P>
      </>
    ),
  },
  {
    id: 'coverage',
    title: '保障产品',
    content: (
      <>
        <P>
          如果您在租赁过程中选择了我们提供的某些保障产品，我们会将您的个人信息提供给承保该产品的保险公司，以便您与该保险公司订立相关合同。
        </P>
        <P>
          如您就这些保障产品提出索赔，与索赔有关的个人信息将被提供给保险公司及其指定的理赔处理方。保险公司对您个人信息的使用将受其自身隐私声明约束。
        </P>
      </>
    ),
  },
  {
    id: 'vehicle-data',
    title: '车辆数据',
    content: (
      <>
        <P>
          您向 YITU 租用的部分车辆可能配备联网设备，这些设备允许我们向车辆发送指令并接收一定信息，包括来自 GPS 系统的地理位置数据。
        </P>
        <P>
          YITU 的租车门店也可能安装视频监控系统以及在车辆进出场地时记录影像的摄像头。这些设备可能会拍摄您、授权驾驶员及乘客的图像或照片。
        </P>
      </>
    ),
  },
  {
    id: 'online-data',
    title: '在线数据',
    content: (
      <>
        <P>
          当您下载、访问或使用我们的网站及/或 App 时，YITU 会自动收集一些技术信息，包括：
        </P>
        <H3>IP 地址与自动收集的信息</H3>
        <P>
          当您访问我们的网站时，我们可能会收集您的 IP 地址，以帮助诊断系统问题、进行系统管理，并向商业合作伙伴提供汇总信息。我们还可能收集浏览器类型、网络服务提供商、来源页/退出页、操作系统、访问时间以及点击流数据。
        </P>
        <H3>Cookies 与类似技术</H3>
        <P>
          当您访问 www.yiturentalcars.co.nz 时，我们可能会向您的设备发送 cookies。持久性 cookies 用于识别访问页面并提供个性化功能；会话 cookies 则用于客户身份识别过程中的安全验证。
        </P>
        <H3>移动设备 GPS 与推送通知</H3>
        <P>
          如果您授权我们，在使用 App 时我们可能会通过设备的 GPS 收集位置标记，以便为您提供更好的服务，例如显示最近门店。您可随时在设备设置中关闭这些功能。
        </P>
      </>
    ),
  },
  {
    id: 'online-advertising',
    title: '在线广告',
    content: (
      <P>
        YITU 会委托第三方代表我们及合作伙伴投放线上或电子广告。这些第三方会利用您访问我们网站及使用 App 的数据，为您推送更符合兴趣的个性化广告。此类信息通常通过 cookies、脚本、像素标签、网络信标及其他类似技术收集。
      </P>
    ),
  },
  {
    id: 'marketing',
    title: '营销',
    content: (
      <>
        <P>
          YITU 可能会与第三方共享个人信息，以协助我们完成营销与推广项目，例如管理社交媒体页面、举办活动或发送营销信息。
        </P>
        <P>
          只有在您已经同意，或法律允许的情况下，我们才会使用您的个人信息向您发送营销内容。您可随时撤回同意，具体方式请参见“您的选择”部分。
        </P>
      </>
    ),
  },
  {
    id: 'information-sharing',
    title: '信息共享',
    content: (
      <>
        <P>YITU 可能会与关联及非关联机构共享您的个人信息，包括：</P>
        <UL>
          <LI><strong>独立加盟商及网络服务提供者</strong>：用于创建和确认预订、提供奖励计划、连接企业账户以及提供客户支持</LI>
          <LI><strong>旅行代理</strong>：用于创建和确认预订、处理付款与退款、提供客户支持</LI>
          <LI><strong>您的雇主或所属组织</strong>：用于核验资格并连接企业或商务账户</LI>
          <LI><strong>银行卡发卡机构</strong>：用于处理付款、退款及欺诈审查</LI>
          <LI><strong>IT 服务提供商</strong>：用于支持我们的 IT 系统与基础设施</LI>
          <LI><strong>政府、监管及执法机构</strong>：用于核验驾照并履行法定义务</LI>
          <LI><strong>保险公司与理赔处理机构</strong>：用于提供和管理您选择的保障产品</LI>
        </UL>
        <P>
          在发生出售、合并、整合、控制权变更、资产转移、破产、重组或清算时，我们也可能将您的个人信息转让或让与第三方。
        </P>
      </>
    ),
  },
  {
    id: 'your-choices',
    title: '您的选择',
    content: (
      <>
        <P>如果您不希望继续接收来自 YITU 的推广及营销信息，您可以：</P>
        <UL>
          <LI>登录账户并更新您的个人资料设置</LI>
          <LI>点击我们发送邮件底部的 “unsubscribe” 链接</LI>
          <LI>直接联系客户服务人员</LI>
        </UL>
        <P>
          即使您选择退出营销信息，我们仍可能就与您业务关系直接相关的事项联系您，例如账户状态更新、调查邀请或预订确认。
        </P>
      </>
    ),
  },
  {
    id: 'safeguards',
    title: '安全保障',
    content: (
      <>
        <P>
          我们非常重视您个人信息的安全，并采取合理措施防止您的信息被未经授权地使用、访问、披露、篡改、销毁或丢失。对于金融或付款信息，我们会使用防火墙和 TLS 加密传输。
        </P>
        <P>
          我们不会在电子邮件、短信或任何其他通讯中向您索取信用卡号、密码、账户号码或 PIN 码等财务或支付信息。
        </P>
        <P>
          您有责任妥善保管您的账户密码、会员编号及 PIN 码。如发生未经授权使用或与您信息有关的其他安全事件，请尽快通知我们。
        </P>
      </>
    ),
  },
  {
    id: 'retention',
    title: '信息保留',
    content: (
      <>
        <P>
          YITU 仅会在合理必要或法律要求的期限内保留您的个人信息。具体保留时间取决于信息种类及处理目的。
        </P>
        <P>我们判断保留期限时会考虑以下因素：</P>
        <UL>
          <LI>您加入常客计划或忠诚度计划的持续时间</LI>
          <LI>您租车的频率，以及最近一次租车时间</LI>
          <LI>是否存在需要我们保留数据的合同或法律义务</LI>
          <LI>是否存在与您和我们关系相关的持续法律索赔</LI>
          <LI>该个人信息是否属于特殊类别信息；若是，通常适用更短保留期限</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'international',
    title: '国际传输',
    content: (
      <P>
        我们从您处收集的信息可能会被传输给代表我们运营的 IT 供应商并由其存储，尤其包括我们的预订引擎托管服务商。我们也会将信息传输给若干业务应用服务商，例如 CRM、营销应用及营销服务提供商。这些提供商主要位于新西兰、澳大利亚和中国。
      </P>
    ),
  },
  {
    id: 'your-rights',
    title: '您的隐私权利',
    content: (
      <>
        <P>在我们处理您的个人信息时，您可能享有以下权利：</P>
        <UL>
          <LI><strong>查阅权</strong>：您有权要求获取我们持有的关于您的个人信息副本</LI>
          <LI><strong>更正权</strong>：您有权要求我们更正有关您的不准确信息</LI>
          <LI><strong>撤回同意权</strong>：如果我们基于您的同意处理个人信息，您可随时撤回该同意</LI>
          <LI><strong>投诉权</strong>：如果您认为我们未充分尊重您的隐私，请联系我们的数据保护负责人</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'contact',
    title: '数据控制者与联系方式',
    content: (
      <>
        <P>如您对隐私相关事宜有任何问题，可通过以下方式联系我们的数据保护负责人：</P>
        <div className="bg-off-white border border-black/10 rounded-card p-5 space-y-3 text-[14px]">
          <div>
            <span className="font-semibold text-navy block mb-0.5">邮寄</span>
            <span className="text-muted">Data Privacy Officer, YITU Group, 222 Main South Road, Hornby, Christchurch 8042</span>
          </div>
          <div>
            <span className="font-semibold text-navy block mb-0.5">电话</span>
            <a href="tel:0800948888" className="text-orange hover:underline">0800 948 888</a>
          </div>
          <div>
            <span className="font-semibold text-navy block mb-0.5">电子邮箱</span>
            <a href="mailto:info@yitugroup.co.nz" className="text-orange hover:underline">info@yitugroup.co.nz</a>
          </div>
        </div>
      </>
    ),
  },
]
