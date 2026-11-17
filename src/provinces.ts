export interface ProvinceUnit {
  id: string
  name: string
  mapId: string
}

// 32 operating units following the supplied reference: 30 provinces plus Tehran and Tehran Counties.
export const PROVINCE_UNITS: ProvinceUnit[] = [
  { id: 'east-azerbaijan', name: 'آذربایجان شرقی', mapId: 'IR-01' },
  { id: 'west-azerbaijan', name: 'آذربایجان غربی', mapId: 'IR-02' },
  { id: 'ardabil', name: 'اردبیل', mapId: 'IR-03' },
  { id: 'isfahan', name: 'اصفهان', mapId: 'IR-04' },
  { id: 'alborz', name: 'البرز', mapId: 'IR-32' },
  { id: 'ilam', name: 'ایلام', mapId: 'IR-05' },
  { id: 'bushehr', name: 'بوشهر', mapId: 'IR-06' },
  { id: 'tehran-city', name: 'تهران', mapId: 'IR-07' },
  { id: 'tehran-counties', name: 'شهرستان‌های تهران', mapId: 'IR-07' },
  { id: 'chaharmahal', name: 'چهارمحال و بختیاری', mapId: 'IR-08' },
  { id: 'south-khorasan', name: 'خراسان جنوبی', mapId: 'IR-29' },
  { id: 'razavi-khorasan', name: 'خراسان رضوی', mapId: 'IR-30' },
  { id: 'north-khorasan', name: 'خراسان شمالی', mapId: 'IR-31' },
  { id: 'khuzestan', name: 'خوزستان', mapId: 'IR-10' },
  { id: 'zanjan', name: 'زنجان', mapId: 'IR-11' },
  { id: 'semnan', name: 'سمنان', mapId: 'IR-12' },
  { id: 'sistan-baluchestan', name: 'سیستان و بلوچستان', mapId: 'IR-13' },
  { id: 'fars', name: 'فارس', mapId: 'IR-14' },
  { id: 'qazvin', name: 'قزوین', mapId: 'IR-28' },
  { id: 'qom', name: 'قم', mapId: 'IR-26' },
  { id: 'kordestan', name: 'کردستان', mapId: 'IR-16' },
  { id: 'kerman', name: 'کرمان', mapId: 'IR-15' },
  { id: 'kermanshah', name: 'کرمانشاه', mapId: 'IR-17' },
  { id: 'kohgiluyeh-boyerahmad', name: 'کهگیلویه و بویراحمد', mapId: 'IR-18' },
  { id: 'golestan', name: 'گلستان', mapId: 'IR-27' },
  { id: 'gilan', name: 'گیلان', mapId: 'IR-19' },
  { id: 'lorestan', name: 'لرستان', mapId: 'IR-20' },
  { id: 'mazandaran', name: 'مازندران', mapId: 'IR-21' },
  { id: 'markazi', name: 'مرکزی', mapId: 'IR-22' },
  { id: 'hormozgan', name: 'هرمزگان', mapId: 'IR-23' },
  { id: 'hamadan', name: 'همدان', mapId: 'IR-24' },
  { id: 'yazd', name: 'یزد', mapId: 'IR-25' },
]

export const SORTED_PROVINCE_UNITS = [...PROVINCE_UNITS].sort((a, b) =>
  new Intl.Collator('fa').compare(a.name, b.name)
)
