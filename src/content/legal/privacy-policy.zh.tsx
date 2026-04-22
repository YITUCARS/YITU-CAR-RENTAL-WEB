import {buildLongformSections, buildTocLinks, readLegalText} from './longform'

const text = readLegalText('privacy-policy.zh.txt')

const DEFINITIONS = [
  {id: 'getting-started', title: '入门指南', start: '隐私声明', end: '租车服务'},
  {id: 'renting', title: '租车服务', start: '租车服务', end: '常客租赁计划'},
  {id: 'frequent-renter', title: '常客租赁计划', start: '常客租赁计划', end: '承保产品'},
  {id: 'coverage', title: '承保产品', start: '承保产品', end: '车辆数据'},
  {id: 'vehicle-data', title: '车辆数据', start: '车辆数据', end: '照片与视频'},
  {id: 'photos-video', title: '照片与视频', start: '照片与视频', end: '在线数据'},
  {id: 'online-data', title: '在线数据', start: '在线数据', end: '在线广告'},
  {id: 'online-advertising', title: '在线广告', start: '在线广告', end: '市场营销'},
  {id: 'marketing', title: '市场营销', start: '市场营销', end: '分析工具'},
  {id: 'analytics', title: '分析工具', start: '分析工具', end: '儿童'},
  {id: 'children', title: '儿童', start: '儿童', end: '信息共享'},
  {id: 'information-sharing', title: '信息共享', start: '信息共享', end: '您的选择'},
  {id: 'your-choices', title: '您的选择', start: '您的选择', end: '安全保障'},
  {id: 'safeguards', title: '安全保障', start: '安全保障', end: '信息保留'},
  {id: 'retention', title: '信息保留', start: '信息保留', end: '国际数据传输'},
  {id: 'international', title: '国际数据传输', start: '国际数据传输', end: '您的隐私权'},
  {id: 'your-rights', title: '您的隐私权', start: '您的隐私权', end: '各国数据控制方及联系方式'},
  {id: 'contact', title: '联系方式', start: '各国数据控制方及联系方式'},
]

export const zhPrivacyToc = buildTocLinks(DEFINITIONS)
export const zhPrivacySections = buildLongformSections(text, DEFINITIONS)
