const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const SUPA_URL = html.match(/const SUPA_URL='([^']+)'/)?.[1];
const SUPA_KEY = html.match(/const SUPA_KEY='([^']+)'/)?.[1];

if (!SUPA_URL || !SUPA_KEY) {
  throw new Error('Missing Supabase config in index.html');
}

const tenantId = '00000000-0000-0000-0000-000000000001';

const leads = [
  {
    id: '10000000-0000-4000-8000-000000000301',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Russell St',
    contact: 'phone:03 9639 1633',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本餐饮外卖供给：China Bar Russell St，公开官网显示可通过 UberEats、DoorDash、HungryPanda、Fantuan 等平台配送。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: '235 Russell Street, Melbourne VIC 3000',
      service_types: ['中餐', '亚洲餐', '外卖', '夜宵'],
      delivery_platforms: ['UberEats', 'DoorDash', 'HungryPanda', 'Fantuan'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000302',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Swanston St',
    contact: 'phone:03 9639 6988',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本餐饮外卖供给：China Bar Swanston St，公开官网显示可通过 UberEats、DoorDash、HungryPanda、Fantuan 等平台配送。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: '257-259 Swanston Street, Melbourne VIC 3000',
      service_types: ['中餐', '亚洲餐', '外卖', '夜宵'],
      delivery_platforms: ['UberEats', 'DoorDash', 'HungryPanda', 'Fantuan'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000303',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Glen Waverley',
    contact: 'phone:03 9561 6808',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本东南区餐饮外卖供给：China Bar Glen Waverley，公开官网显示支持多个外卖平台。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: '68 Kingsway, Glen Waverley VIC 3150',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash', 'HungryPanda', 'Fantuan'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000304',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Burwood',
    contact: 'phone:03 9088 8199',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本东区餐饮外卖供给：China Bar Burwood，公开官网显示支持 UberEats、DoorDash、HungryPanda、Fantuan。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'G8, 172-210 Burwood Hwy, Burwood East VIC 3151',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash', 'HungryPanda', 'Fantuan'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000305',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Docklands',
    contact: 'phone:03 9670 0268',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Docklands 餐饮外卖供给：China Bar Docklands，公开官网显示可通过 EASI、HungryPanda、Fantuan、UberEats、DoorDash 配送。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'T13, 90 Waterfront Way, Docklands VIC 3008',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['EASI', 'HungryPanda', 'Fantuan', 'UberEats', 'DoorDash'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000306',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Doncaster Rd',
    contact: 'phone:03 9848 8003',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Doncaster 餐饮外卖供给：China Bar Doncaster Rd，公开官网显示可通过 EASI、HungryPanda、Fantuan、UberEats、DoorDash 配送。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: '558 Doncaster Road, Doncaster VIC 3108',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['EASI', 'HungryPanda', 'Fantuan', 'UberEats', 'DoorDash'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000307',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'Flower Drum',
    contact: 'phone:+61 3 9662 3655',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_booking',
    message: '墨尔本中餐/粤菜高端餐厅供给：Flower Drum，官网显示可预订，适合作为用户订位、商务宴请和本地餐厅推荐候选。',
    next_action: 'manual_booking_flow_and_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'Flower Drum official website',
      source_url: 'https://flowerdrum.melbourne/',
      address: '17 Market Lane, Melbourne VIC 3000',
      service_types: ['粤菜', '餐厅预订', '商务宴请'],
      verification_status: 'official_website_public_contact',
      compliance_note: '公开官网信息；预订、空位、价格和合作方式需实时确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000311',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Blackburn Square',
    contact: 'phone:03 7002 6273',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Blackburn 餐饮外卖供给：China Bar Blackburn Square，公开官网显示支持 UberEats、DoorDash、HungryPanda、Fantuan。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'Blackburn Square Shopping Centre, T18, 64/104 Springfield Rd, Blackburn VIC 3130',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash', 'HungryPanda', 'Fantuan'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000312',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Casey',
    contact: 'phone:03 8794 9258',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Casey/Narre Warren South 餐饮外卖供给：China Bar Casey，公开官网显示支持 UberEats、DoorDash。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'Shop 102F, 400 Cranbourne Rd, Narre Warren South VIC 3805',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000313',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Elizabeth St',
    contact: 'phone:03 7002 6275',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 CBD 餐饮外卖供给：China Bar Elizabeth St，公开官网显示 24 小时营业并支持 UberEats、DoorDash、HungryPanda。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: '275 Elizabeth St, Melbourne VIC 3000',
      service_types: ['中餐', '亚洲餐', '外卖', '夜宵'],
      delivery_platforms: ['UberEats', 'DoorDash', 'HungryPanda'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000314',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Northland',
    contact: 'phone:03 8590 6889',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Northland 餐饮外卖供给：China Bar Northland，公开官网显示支持 UberEats、DoorDash。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'Shop C022, 2-50 Murray Road, East Preston VIC 3072',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000315',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Doncaster Westfield',
    contact: 'phone:03 9840 0028',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Doncaster 餐饮外卖供给：China Bar Doncaster Westfield，公开官网显示支持 EASI、HungryPanda、UberEats。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'Shop 115, 619 Doncaster Road, Doncaster VIC 3108',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['EASI', 'HungryPanda', 'UberEats'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000316',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Hawthorn',
    contact: 'phone:03 7002 6272',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Hawthorn 餐饮外卖供给：China Bar Hawthorn，公开官网显示支持 UberEats、DoorDash、HungryPanda。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: '734 Glenferrie Rd, Hawthorn VIC 3122',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash', 'HungryPanda'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000317',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Plenty Valley',
    contact: 'phone:03 9404 5866',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Plenty Valley 餐饮外卖供给：China Bar Plenty Valley，公开官网显示支持 UberEats、DoorDash。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'FC6, 415 Mcdonalds Road, Mill Park VIC 3082',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000318',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Brimbank',
    contact: 'phone:03 7002 6277',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本西区餐饮外卖供给：China Bar Brimbank，公开官网显示支持 UberEats、DoorDash。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'Brimbank Shopping Centre, T028, 28-72 Neale Road, Deer Park VIC 3023',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000319',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Craigieburn',
    contact: 'phone:03 9989 3578',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本北区餐饮外卖供给：China Bar Craigieburn，公开官网显示支持 UberEats、DoorDash。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'Craigieburn Plaza Shopping Ctr, Craigieburn Rd, Craigieburn VIC 3064',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000320',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Dandenong',
    contact: 'phone:03 7002 6074',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Dandenong 餐饮外卖供给：China Bar Dandenong，公开官网显示支持 UberEats、DoorDash。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'Dandenong Square, 55 McCrae St, Dandenong VIC 3175',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000321',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Fitzroy',
    contact: 'phone:03 9191 6464',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Fitzroy 餐饮外卖供给：China Bar Fitzroy，公开官网显示支持 UberEats、DoorDash、HungryPanda。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: '325 Brunswick Street, Fitzroy VIC 3065',
      service_types: ['中餐', '亚洲餐', '外卖', '夜宵'],
      delivery_platforms: ['UberEats', 'DoorDash', 'HungryPanda'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000322',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Niddrie',
    contact: 'phone:03 8001 7670',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本 Niddrie 餐饮外卖供给：China Bar Niddrie，公开官网显示支持 UberEats、DoorDash。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'Shop 16, Niddrie Central, 383 Keilor Rd, Essendon VIC 3040',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000323',
    lead_type: 'supply',
    channel: 'restaurant_supply_intel',
    name: 'China Bar Point Cook',
    contact: 'phone:03 8691 6889',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'restaurant_supply_delivery',
    message: '墨尔本西区 Point Cook 餐饮外卖供给：China Bar Point Cook，公开官网显示支持 UberEats、DoorDash。',
    next_action: 'manual_contact_and_delivery_partnership_check',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'A',
      source_platform: 'China Bar official website',
      source_url: 'https://www.chinabar.com.au/',
      address: 'Shop 444/447, Stockland, Level 1/2 Main St, Point Cook VIC 3030',
      service_types: ['中餐', '亚洲餐', '外卖'],
      delivery_platforms: ['UberEats', 'DoorDash'],
      verification_status: 'official_website_public_location',
      compliance_note: '公开官网信息；合作、菜单、营业状态和接单意愿需人工确认。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000308',
    lead_type: 'supply',
    channel: 'delivery_platform_intel',
    name: 'Fantuan Delivery / 饭团外卖',
    contact: 'source:https://fantuan.ca',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'delivery_platform_source',
    message: '亚洲餐饮外卖平台供给渠道：Fantuan Delivery，公开资料显示服务覆盖澳洲，可作为华伴外卖商家/配送供给发现渠道。',
    next_action: 'research_platform_merchant_and_courier_channels',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'B',
      source_platform: 'public web / Fantuan',
      source_url: 'https://fantuan.ca',
      service_types: ['外卖平台', '亚洲餐饮', '配送渠道'],
      verification_status: 'public_platform_source',
      compliance_note: '作为平台渠道源；不自动注册、不绕过平台限制，只记录公开信息和人工合作线索。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000309',
    lead_type: 'supply',
    channel: 'delivery_platform_intel',
    name: 'HungryPanda / 熊猫外卖',
    contact: 'source:public_web_search',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'delivery_platform_source',
    message: '亚洲餐饮外卖平台供给渠道：HungryPanda，公开报道显示覆盖澳洲并服务亚洲餐馆、用户和配送员，可作为商家/外卖员供给发现渠道。',
    next_action: 'research_platform_merchant_and_courier_channels',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'B',
      source_platform: 'public web / HungryPanda',
      source_url: 'https://www.hungrypanda.co/',
      service_types: ['外卖平台', '亚洲餐饮', '配送渠道'],
      verification_status: 'public_platform_source_needs_local_check',
      compliance_note: '作为平台渠道源；不自动注册、不绕过平台限制，只记录公开信息和人工合作线索。'
    }
  },
  {
    id: '10000000-0000-4000-8000-000000000310',
    lead_type: 'supply',
    channel: 'delivery_platform_intel',
    name: 'DoorDash Melbourne',
    contact: 'source:https://www.doordash.com/en-AU',
    city: 'Melbourne',
    country: 'Australia',
    status: 'new',
    stage: 'public_supply_review',
    need_type: 'delivery_platform_source',
    message: '主流外卖平台供给渠道：DoorDash，公开资料显示已在墨尔本开展服务，可作为餐馆/配送供给和价格对比渠道。',
    next_action: 'research_platform_merchant_and_courier_channels',
    fields: {
      event: 'public_supply_seed_20260705',
      priority_score: 'B',
      source_platform: 'public web / DoorDash',
      source_url: 'https://www.doordash.com/en-AU',
      service_types: ['外卖平台', '配送渠道', '餐馆供给'],
      verification_status: 'public_platform_source',
      compliance_note: '作为平台渠道源；只做公开搜索和人工合作跟进。'
    }
  }
];

async function upsertLeads() {
  const payload = leads.map((lead) => ({
    ...lead,
    tenant_id: tenantId
  }));
  const res = await fetch(`${SUPA_URL}/rest/v1/beta_leads?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${text}`);
  }
  const rows = JSON.parse(text);
  console.log(JSON.stringify({
    inserted_or_updated: rows.length,
    names: rows.map((row) => row.name)
  }, null, 2));
}

upsertLeads().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
