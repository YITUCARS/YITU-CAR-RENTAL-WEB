import {buildLongformSections, buildTocLinks, readLegalText} from './longform'

const text = readLegalText('terms-conditions.zh.txt')

const DEFINITIONS = [
  {id: 'overview-contact', title: '概览与联系方式', start: 'YITU 新西兰租赁条款与条件', end: '1. 了解您的租赁协议'},
  {id: 'understanding', title: '1. 了解您的租赁协议', start: '1. 了解您的租赁协议', end: '定义'},
  {id: 'definitions', title: '定义、释义与优先顺序', start: '定义', end: '2. 驾驶员'},
  {id: 'driver', title: '2. 驾驶员', start: '2. 驾驶员', end: '3. 车辆的驾驶区域限制'},
  {id: 'where-to-drive', title: '3. 车辆的驾驶区域限制', start: '3. 车辆的驾驶区域限制', end: '4. 车辆保养、安全与清洁'},
  {id: 'vehicle-maintenance', title: '4. 车辆保养、安全与清洁', start: '4. 车辆保养、安全与清洁', end: '5. 车辆归还'},
  {id: 'return', title: '5. 车辆归还', start: '5. 车辆归还', end: '6. 燃油'},
  {id: 'fuel', title: '6. 燃油', start: '6. 燃油', end: '7. 损失或损坏的责任'},
  {id: 'liability', title: '7. 损失或损坏的责任', start: '7. 损失或损坏的责任', end: '8. 损失及损坏豁免（“基础保险”或“YITU超级保障”）'},
  {id: 'ldw', title: '8. 损失及损坏豁免', start: '8. 损失及损坏豁免（“基础保险”或“YITU超级保障”）', end: '9. 雪地驾驶'},
  {id: 'snow', title: '9. 雪地驾驶', start: '9. 雪地驾驶', end: '10. 损失或损坏的评估与支付'},
  {id: 'assessment', title: '10. 损失或损坏的评估与支付', start: '10. 损失或损坏的评估与支付', end: '11. 索赔与诉讼程序及发生事故时的应对措施'},
  {id: 'claims', title: '11. 索赔与诉讼程序', start: '11. 索赔与诉讼程序及发生事故时的应对措施', end: '12. 付款'},
  {id: 'payment', title: '12. 付款', start: '12. 付款', end: '13. 终止'},
  {id: 'termination', title: '13. 终止', start: '13. 终止', end: '14. 车辆内财物'},
  {id: 'belongings', title: '14. 车辆内财物', start: '14. 车辆内财物', end: '15. 争议解决'},
  {id: 'dispute', title: '15. 争议解决', start: '15. 争议解决', end: '16. 新西兰消费者法'},
  {id: 'nz-consumer', title: '16. 新西兰消费者法', start: '16. 新西兰消费者法', end: '17. 适用法律与管辖权'},
  {id: 'governing-law', title: '17. 适用法律与管辖权', start: '17. 适用法律与管辖权', end: '18. 商品及服务税（GST）'},
  {id: 'gst', title: '18. 商品及服务税（GST）', start: '18. 商品及服务税（GST）', end: '19. 隐私'},
  {id: 'privacy', title: '19. 隐私', start: '19. 隐私', end: '附件 B：价格表'},
  {id: 'pricing-schedule', title: '附件 B：价格表', start: '附件 B：价格表', end: '附件C：电动汽车条款与条件'},
  {id: 'ev-terms', title: '附件 C：电动汽车条款与条件', start: '附件C：电动汽车条款与条件', end: '附件 D：立即支付条款与条件'},
  {id: 'pay-now', title: '附件 D：立即支付条款与条件', start: '附件 D：立即支付条款与条件'},
]

export const zhTermsToc = buildTocLinks(DEFINITIONS)
export const zhTermsSections = buildLongformSections(text, DEFINITIONS)
