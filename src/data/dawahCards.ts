import type {ClassicDawahCard, PdfBookItem, VisitorReviewItem} from '../types.ts';

export const DAWAH_CARDS_RESET_EPOCH = '2026-11-27T15:10:00.000Z';

export function isConciseClassicCard(card: ClassicDawahCard | null | undefined): boolean {
  if (!card || !Array.isArray(card.lines) || card.lines.length < 2 || card.lines.length > 4) {
    return false;
  }
  const lineTexts = card.lines.map((l) => (l?.text || '').trim()).filter(Boolean);
  if (lineTexts.length < 2 || lineTexts.length > 4) return false;
  if (lineTexts.some((t) => t.length > 44 || t.split(/\s+/).length > 7)) return false;
  const fullText = lineTexts.join(' ');
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;
  return totalWords <= 20 && fullText.length <= 125;
}

export const CLASSIC_DAWAH_CARDS: ClassicDawahCard[] = [
  // ١) خواطر ومواعظ قصيرة
  {
    id: 'card_ibn_hazm',
    speakerLine: 'قَالَ الإِمَامُ ابْنُ حَزْمٍ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'وَلَيْسَ كُلُّ صَدِيقٍ', color: '#1E3A8A'},
      {text: 'نَاصِحًا لَكِنْ كُلُّ', color: '#111827'},
      {text: 'نَاصِحٍ صَدِيقٌ', color: '#1E3A8A'},
    ],
    source: 'الأَخْلَاقُ وَالسِّيَرُ (٤٢)',
    category: 'خواطر ومواعظ قصيرة',
  },
  {
    id: 'card_ibn_alqayyim',
    speakerLine: 'قَالَ الإِمَامُ ابْنُ القَيِّمِ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'إِذَا كَذَبَ العَبْدُ تَبَاعَدَ', color: '#991B1B'},
      {text: 'مِنْهُ المَلَكُ مِيلًا', color: '#111827'},
      {text: 'مِنْ نَتَنِ رِيحِهِ', color: '#991B1B'},
    ],
    source: '[الدَّاءُ وَالدَّوَاءُ ص ٢٥٠]',
    category: 'خواطر ومواعظ قصيرة',
  },
  {
    id: 'card_mujahid',
    speakerLine: 'قَالَ مُجَاهِدٌ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'الأَوَّابُ الحَفِيظُ', color: '#111827'},
      {text: 'الَّذِي يُذْنِبُ الذَّنْبَ سِرًّا', color: '#991B1B'},
      {text: 'ثُمَّ يَتُوبُ مِنْهُ سِرًّا', color: '#065F46'},
    ],
    source: 'كِتَابُ التَّوْبَةِ (٢٣٩)',
    category: 'خواطر ومواعظ قصيرة',
  },
  {
    id: 'card_ibn_umar',
    speakerLine: 'قَالَ ابْنُ عُمَرَ رَضِيَ اللَّهُ عَنْهُ',
    lines: [
      {text: 'التَّقْوَى أَنْ لَا', color: '#1E3A8A'},
      {text: 'تَرَى نَفْسَكَ خَيْرًا', color: '#111827'},
      {text: 'مِنْ أَحَدٍ', color: '#1E3A8A'},
    ],
    source: '[تَفْسِيرُ البَغَوِيِّ ١-٦٠]',
    category: 'خواطر ومواعظ قصيرة',
  },
  {
    id: 'card_light_hasan_days',
    speakerLine: 'قَالَ الحَسَنُ البَصْرِيُّ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'إِنَّمَا أَنْتَ أَيَّامٌ', color: '#111827'},
      {text: 'كُلَّمَا ذَهَبَ يَوْمٌ', color: '#991B1B'},
      {text: 'ذَهَبَ بَعْضُكَ', color: '#1E3A8A'},
    ],
    source: 'حِلْيَةُ الأَوْلِيَاءِ (١٤٨/٢)',
    category: 'خواطر ومواعظ قصيرة',
  },
  {
    id: 'card_khatera_tumanina',
    speakerLine: 'خَاطِرَةٌ إِيمَانِيَّةٌ هَادِئَةٌ',
    lines: [
      {text: 'طُمَأْنِينَةُ القَلْبِ تَبْدَأُ', color: '#065F46'},
      {text: 'بِذِكْرِ اللَّهِ تَعَالَى', color: '#111827'},
      {text: 'وَحُسْنِ الظَّنِّ بِهِ', color: '#1E3A8A'},
    ],
    source: 'خَوَاطِرُ وَمَوَاعِظُ قَصِيرَةٌ',
    category: 'خواطر ومواعظ قصيرة',
  },
  {
    id: 'card_khatera_khiyarah',
    speakerLine: 'إِشْرَاقَةُ يَقِينٍ',
    lines: [
      {text: 'لَا تَحْزَنْ عَلَى فَوْتٍ', color: '#1E3A8A'},
      {text: 'فَخِيَرَةُ اللَّهِ لَكَ', color: '#111827'},
      {text: 'أَرْحَمُ وَأَجْمَلُ', color: '#065F46'},
    ],
    source: 'خَوَاطِرُ وَمَوَاعِظُ قَصِيرَةٌ',
    category: 'خواطر ومواعظ قصيرة',
  },

  // ٢) أبيات شعر عربية فصيحة
  {
    id: 'card_poem_shafii_days',
    speakerLine: 'قَالَ الإِمَامُ الشَّافِعِيُّ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'دَعِ الأَيَّامَ تَفْعَلُ مَا تَشَاءُ', color: '#1E3A8A'},
      {text: 'وَطِبْ نَفْسًا إِذَا حَكَمَ القَضَاءُ', color: '#065F46'},
    ],
    source: 'دِيوَانُ الإِمَامِ الشَّافِعِيِّ',
    category: 'أبيات شعر عربية',
  },
  {
    id: 'card_poem_shafii_nush',
    speakerLine: 'قَالَ الإِمَامُ الشَّافِعِيُّ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'تَعَمَّدْنِي بِنُصْحِكَ فِي انْفِرَادِي', color: '#111827'},
      {text: 'وَجَنِّبْنِي النَّصِيحَةَ فِي الجَمَاعَهْ', color: '#1E3A8A'},
    ],
    source: 'دِيوَانُ الإِمَامِ الشَّافِعِيِّ',
    category: 'أبيات شعر عربية',
  },
  {
    id: 'card_poem_abu_atahiya',
    speakerLine: 'قَالَ أَبُو العَتَاهِيَةِ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'تَرْجُو النَّجَاةَ وَلَمْ تَسْلُكْ مَسَالِكَهَا', color: '#991B1B'},
      {text: 'إِنَّ السَّفِينَةَ لَا تَجْرِي عَلَى اليَبَسِ', color: '#111827'},
    ],
    source: 'دِيوَانُ أَبِي العَتَاهِيَةِ',
    category: 'أبيات شعر عربية',
  },
  {
    id: 'card_poem_ibn_mubarak',
    speakerLine: 'يُنْسَبُ لِلْأَدَبِ السَّلَفِيِّ فِي الصُّحْبَةِ',
    lines: [
      {text: 'إِذَا صَاحَبْتَ فِي أَيَّامِ بُؤْسٍ', color: '#065F46'},
      {text: 'فَلَا تَنْسَ المَوَدَّةَ فِي الرَّخَاءِ', color: '#111827'},
    ],
    source: 'مِنْ رَوَائِعِ الشِّعْرِ العَرَبِيِّ',
    category: 'أبيات شعر عربية',
  },

  // ٣) طرائف حقيقية موثقة
  {
    id: 'card_turfah_shabi_iblis',
    speakerLine: 'سُئِلَ الإِمَامُ الشَّعْبِيُّ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'مَا اسْمُ امْرَأَةِ إِبْلِيسَ؟', color: '#1E3A8A'},
      {text: 'فَأَجَابَ مُبْتَسِمًا:', color: '#111827'},
      {text: 'ذَاكَ عُرْسٌ مَا شَهِدْنَاهُ!', color: '#065F46'},
    ],
    source: 'أَخْبَارُ الظُّرَفَاءِ لِابْنِ الجَوْزِيِّ',
    category: 'طرائف موثقة',
  },
  {
    id: 'card_turfah_shabi_ihram',
    speakerLine: 'مِنْ طَرَائِفِ الإِمَامِ الشَّعْبِيِّ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'سُئِلَ: أَيَحُكُّ المُحْرِمُ جَسَدَهُ؟ قَالَ: نَعَمْ', color: '#111827'},
      {text: 'قِيلَ: فَكَمْ يَحُكُّ؟', color: '#1E3A8A'},
      {text: 'قَالَ: حَتَّى يَبْدُوَ العَظْمُ!', color: '#B45309'},
    ],
    source: 'أَخْبَارُ الأَذْكِيَاءِ لِابْنِ الجَوْزِيِّ',
    category: 'طرائف موثقة',
  },
  {
    id: 'card_turfah_asmai_farah',
    speakerLine: 'مِنْ نَوَادِرِ الأَصْمَعِيِّ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'سَأَلْتُ أَعْرَابِيًّا: أَتَهْمِزُ الفَأْرَةَ؟', color: '#1E3A8A'},
      {text: 'فَأَجَابَنِي بِسُرْعَةٍ:', color: '#111827'},
      {text: 'القِطُّ يَهْمِزُهَا!', color: '#065F46'},
    ],
    source: 'عُيُونُ الأَخْبَارِ لِابْنِ قُتَيْبَةَ',
    category: 'طرائف موثقة',
  },
  {
    id: 'card_turfah_ahnaf_hilm',
    speakerLine: 'قِيلَ لِلْأَحْنَفِ بْنِ قَيْسٍ رَحِمَهُ اللَّهُ',
    lines: [
      {text: 'مِمَّنْ تَعَلَّمْتَ الحِلْمَ؟', color: '#1E3A8A'},
      {text: 'قَالَ: مِنْ قَيْسِ بْنِ عَاصِمٍ؛', color: '#111827'},
      {text: 'رَأَيْتُهُ يُحَدِّثُ وَالعَقْرَبُ تَلْسَعُهُ!', color: '#991B1B'},
    ],
    source: 'البَيَانُ وَالتَّبْيِينُ لِلْجَاحِظِ',
    category: 'طرائف موثقة',
  },

  // ٤) أحاديث نبوية صحيحة
  {
    id: 'card_light_kalimah',
    speakerLine: 'قَالَ رَسُولُ اللَّهِ ﷺ',
    lines: [
      {text: '« الكَلِمَةُ', color: '#1E3A8A'},
      {text: 'الطَّيِّبَةُ', color: '#111827'},
      {text: 'صَدَقَةٌ »', color: '#065F46'},
    ],
    source: 'صَحِيحُ البُخَارِيِّ (٢٩٨٩)',
    category: 'أحاديث نبوية صحيحة',
  },
  {
    id: 'card_light_quran_best',
    speakerLine: 'قَالَ رَسُولُ اللَّهِ ﷺ',
    lines: [
      {text: '« خَيْرُكُمْ مَنْ تَعَلَّمَ', color: '#065F46'},
      {text: 'القُرْآنَ', color: '#111827'},
      {text: 'وَعَلَّمَهُ »', color: '#1E3A8A'},
    ],
    source: 'صَحِيحُ البُخَارِيِّ (٥٠٢٧)',
    category: 'أحاديث نبوية صحيحة',
  },
  {
    id: 'card_light_taqwa_wherever',
    speakerLine: 'قَالَ رَسُولُ اللَّهِ ﷺ',
    lines: [
      {text: '« اتَّقِ اللَّهَ', color: '#1E3A8A'},
      {text: 'حَيْثُمَا', color: '#111827'},
      {text: 'كُنْتَ »', color: '#065F46'},
    ],
    source: 'سُنَنُ التِّرْمِذِيِّ (١٩٨٧) · حَسَنٌ صَحِيحٌ',
    category: 'أحاديث نبوية صحيحة',
  },
];

export const LIBRARY_PDF_BOOKS: PdfBookItem[] = [
  {
    id: 'pdf_athkar_ikhtiyar',
    title: 'الاختيار لأهم صحاح الأذكار',
    author: 'فضيلة الشيخ يحيى بن علي الحجوري حفظه الله',
    category: 'الأذكار والأدعية',
    pages: 96,
    sizeLabel: 'النسخة الرسمية',
    summary: 'مختصر جامع لأهم الأذكار والأدعية الصحيحة الثابتة عن النبي ﷺ بأسانيدها وألفاظها المضبوطة.',
    pdfUrl: 'https://sh-yahia.net/',
  },
  {
    id: 'pdf_subh_sharik',
    title: 'الصبح الشارق في نصرة الحق وبيان أصول أهل السنة',
    author: 'فضيلة الشيخ يحيى بن علي الحجوري حفظه الله',
    category: 'العقيدة والمنهج',
    pages: 184,
    sizeLabel: 'النسخة الرسمية',
    summary: 'بيان علمي مؤصل لأصول العقيدة السلفية ومنهج أهل السنة والجماعة بالدليل الصحيح.',
    pdfUrl: 'https://sh-yahia.net/',
  },
  {
    id: 'pdf_tabaqat',
    title: 'الطبقات في تراجم أهل العلم والرواية',
    author: 'فضيلة الشيخ يحيى بن علي الحجوري حفظه الله',
    category: 'السير والتراجم',
    pages: 240,
    sizeLabel: 'النسخة الرسمية',
    summary: 'مصنف علمي في التراجم والتعريف بسير العلماء وطبقات رواة الأثر وأخبارهم.',
    pdfUrl: 'https://sh-yahia.net/',
  },
  {
    id: 'pdf_lamiyah',
    title: 'شرح لامية شيخ الإسلام ابن تيمية',
    author: 'من متون العقيدة السلفية الميسرة',
    category: 'العقيدة والتوحيد',
    pages: 64,
    sizeLabel: 'المكتبة العلمية',
    summary: 'القصيدة اللامية المنسوبة لشيخ الإسلام ابن تيمية رحمه الله في إثبات عقيدة أهل السنة في الصفات والقدر.',
    pdfUrl: 'https://alilmia.com/',
  },
  {
    id: 'pdf_arbayn',
    title: 'الأربعون النووية مع زياداتها والفوائد المستنبطة',
    author: 'الإمام النووي · تحقيق ودراسة علمية',
    category: 'الحديث والسنة',
    pages: 112,
    sizeLabel: 'المكتبة العلمية',
    summary: 'جوامع الكلم النبوي التي عليها مدار الإسلام مع ضبط المتون وتخريج الألفاظ.',
    pdfUrl: 'https://alilmia.com/',
  },
  {
    id: 'pdf_barahin',
    title: 'البراهين الجلية في قواعد السنة والاتباع',
    author: 'مكتبة العقيدة والمنهج',
    category: 'العقيدة والمنهج',
    pages: 128,
    sizeLabel: 'المكتبة العلمية',
    summary: 'أدلة وبراهين واضحة من الكتاب والسنة في تعظيم الوحيين ولزوم الاتباع.',
    pdfUrl: 'https://alilmia.com/',
  },
  {
    id: 'pdf_makki_madani',
    title: 'المكي والمدني في علوم القرآن الكريم',
    author: 'مكتبة علوم القرآن والتفسير',
    category: 'علوم القرآن',
    pages: 88,
    sizeLabel: 'المكتبة العلمية',
    summary: 'دراسة تأصيلية لضوابط المكي والمدني وفوائد معرفتهما في التفسير واستنباط الأحكام.',
    pdfUrl: 'https://alilmia.com/',
  },
  {
    id: 'pdf_hijrah',
    title: 'أحكام الهجرة من بلاد الكفر إلى بلاد الإسلام',
    author: 'رسالة فقهية مؤصلة بالدليل',
    category: 'الفقه والفتاوى',
    pages: 72,
    sizeLabel: 'المكتبة العلمية',
    summary: 'بحث شرعي في بيان أقسام الهجرة وضوابط الإقامة وأحكامها الفقهية.',
    pdfUrl: 'https://sh-yahia.net/',
  },
  {
    id: 'pdf_diya_salikin',
    title: 'ضياء السالكين في المواعظ والآداب الشرعية',
    author: 'دار الحديث والمكتبة الدعوية',
    category: 'الرقائق والآداب',
    pages: 145,
    sizeLabel: 'المكتبة العلمية',
    summary: 'فصول في تربية النفوس، وآداب طلب العلم، وثمار الصدق والإخلاص لله عز وجل.',
    pdfUrl: 'https://alilmia.com/',
  },
  {
    id: 'pdf_fatawa_dirasa',
    title: 'مختارات من الفتاوى والدراسات الفقهية',
    author: 'قسم الفتاوى والأحكام',
    category: 'الفقه والفتاوى',
    pages: 132,
    sizeLabel: 'النسخة الرسمية',
    summary: 'مجموعة فتاوى محررة في العبادات والمعاملات وأحكام الأسرة المسلمة.',
    pdfUrl: 'https://sh-yahia.net/',
  },
];

export const INITIAL_VISITOR_REVIEWS: VisitorReviewItem[] = [
  {
    id: 'rev_1',
    name: 'أبو عبد الله اليمني',
    role: 'طالب علم وزائر دائم',
    rating: 5,
    comment: 'منصة مباركة جمعت بين سلامة المنهج، وجمال التنسيق، وسهولة الوصول للأذكار والمصحف والمواعظ الموثقة.',
    createdAt: '2026-11-18T10:30:00.000Z',
  },
  {
    id: 'rev_2',
    name: 'أم عبد الرحمن',
    role: 'مستخدمة قسم الورد اليومي والأذكار',
    rating: 5,
    comment: 'جزاكم الله خيراً على دعاء الوالدة وبطاقات الأذكار ووضوح الخط المتوسط (18px) المريح للقراءة اليومية.',
    createdAt: '2026-11-20T14:15:00.000Z',
  },
  {
    id: 'rev_3',
    name: 'مستفيد من البطاقات',
    role: 'مهتم بالبطاقات الدعوية',
    rating: 5,
    comment: 'البطاقات الدعوية الكلاسيكية وتحميلها بصيغة PNG ساعدتنا كثيراً في نشر كلام السلف في مجموعات الأسرة.',
    createdAt: '2026-11-22T08:45:00.000Z',
  },
];
