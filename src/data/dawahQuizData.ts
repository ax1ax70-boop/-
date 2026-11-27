import type {DawahQuizQuestion, DawahQuizSubject} from '../types';

export interface QuizSubjectMeta {
  id: Exclude<DawahQuizSubject, 'all'>;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
}

export const DAWAH_QUIZ_SUBJECTS: QuizSubjectMeta[] = [
  {
    id: 'aqeedah',
    labelAr: 'العقيدة والتوحيد',
    labelEn: 'Aqeedah (Creed)',
    descAr: 'أساسيات التوحيد والإيمان على منهج السلف',
    descEn: 'Foundations of Tawheed & Iman',
  },
  {
    id: 'quran',
    labelAr: 'القرآن وعلومه',
    labelEn: 'Noble Quran',
    descAr: 'سور القرآن وتفسيره وعلومه المباركة',
    descEn: 'Surahs, Tafsir & Quranic Sciences',
  },
  {
    id: 'hadith_seerah',
    labelAr: 'السيرة والحديث',
    labelEn: 'Seerah & Hadith',
    descAr: 'سيرة النبي ﷺ والأحاديث الصحيحة',
    descEn: 'Prophetic Biography & Authentic Hadith',
  },
  {
    id: 'fiqh',
    labelAr: 'الفقه والعبادات',
    labelEn: 'Fiqh (Jurisprudence)',
    descAr: 'أحكام الطهارة والصلاة والصيام والزكاة',
    descEn: 'Purification, Prayer, Fasting & Zakah',
  },
  {
    id: 'akhlaq',
    labelAr: 'الأخلاق والتزكية',
    labelEn: 'Akhlaq (Character)',
    descAr: 'آداب المسلم وتزكية النفس وحسن الخلق',
    descEn: 'Islamic Manners & Soul Purification',
  },
];

export const VERIFIED_QUIZ_BANK: DawahQuizQuestion[] = [
  // ==================== AQEEDAH (6) ====================
  {
    id: 'aq_01',
    subject: 'aqeedah',
    questionAr: 'ما أعظم حق أوجبه الله على عباده كما في حديث معاذ بن جبل رضي الله عنه؟',
    questionEn: 'What is the greatest right of Allah upon His servants as stated in the hadith of Muadh ibn Jabal?',
    optionsAr: [
      'أن يعبدوه ولا يشركوا به شيئاً',
      'كثرة الإنفاق في وجوه الخير فقط',
      'صيام النوافل طوال العام',
      'السياحة في الأرض للتفكر',
    ],
    optionsEn: [
      'To worship Him alone and associate nothing with Him',
      'Giving charity only',
      'Fasting every optional day',
      'Traveling the earth continuously',
    ],
    correctIndex: 0,
    explanationAr: 'أخبر النبي ﷺ معاذاً رضي الله عنه أن حق الله على العباد أن يعبدوه ولا يشركوا به شيئاً، وحق العباد على الله ألا يعذب من لا يشرك به شيئاً.',
    explanationEn: 'The Prophet (peace be upon him) informed Muadh that the right of Allah upon His servants is that they worship Him and associate nothing with Him.',
    sourceAr: 'متفق عليه · صحيح البخاري (٢٨٥٦) وصحيح مسلم (٣٠)',
    sourceEn: 'Agreed Upon · Sahih al-Bukhari (2856) & Sahih Muslim (30)',
    points: 20,
  },
  {
    id: 'aq_02',
    subject: 'aqeedah',
    questionAr: 'كم عدد أركان الإيمان التي بيّنها النبي ﷺ في حديث جبريل المشهور؟',
    questionEn: 'How many pillars of Iman (faith) did the Prophet (peace be upon him) state in the Hadith of Jibril?',
    optionsAr: ['أربعة أركان', 'خمسة أركان', 'ستة أركان', 'سبعة أركان'],
    optionsEn: ['Four pillars', 'Five pillars', 'Six pillars', 'Seven pillars'],
    correctIndex: 2,
    explanationAr: 'أركان الإيمان ستة: أن تؤمن بالله، وملائكته، وكتبه، ورسله، واليوم الآخر، وتؤمن بالقدر خيره وشره.',
    explanationEn: 'There are six pillars of faith: belief in Allah, His angels, His books, His messengers, the Last Day, and Divine Decree (Qadr), both good and bad.',
    sourceAr: 'صحيح مسلم (٨) من حديث عمر بن الخطاب رضي الله عنه',
    sourceEn: 'Sahih Muslim (8) · Narrated by Umar ibn al-Khattab',
    points: 20,
  },
  {
    id: 'aq_03',
    subject: 'aqeedah',
    questionAr: 'ما الشرطان الأساسيان لقبول العمل الصالح عند الله تعالى؟',
    questionEn: 'What are the two essential conditions for a righteous deed to be accepted by Allah?',
    optionsAr: [
      'الكثرة والسرعة في الأداء',
      'الإخلاص لله وموافقة سنة النبي ﷺ',
      'إعلان العمل أمام الناس وتوثيقه',
      'أن يكون العمل في المسجد فقط',
    ],
    optionsEn: [
      'Quantity and speed of completion',
      'Sincerity (Ikhlas) for Allah and following the Sunnah',
      'Announcing the deed publicly',
      'Performing it exclusively inside a mosque',
    ],
    correctIndex: 1,
    explanationAr: 'لا يُقبل العمل إلا بشرطين: أن يكون خالصاً لوجه الله تعالى لا رياء فيه، وأن يكون صواباً على هدي رسول الله ﷺ.',
    explanationEn: 'A deed is only accepted with two conditions: pure sincerity for Allah alone, and conformity with the guidance of the Messenger of Allah.',
    sourceAr: 'سورة الكهف: ١١٠ · وتفسير الفضيل بن عياض للعمل الأحسن',
    sourceEn: 'Surah al-Kahf 18:110 · Tafsir of al-Fudayl ibn Iyad',
    points: 20,
  },
  {
    id: 'aq_04',
    subject: 'aqeedah',
    questionAr: 'ما معنى «الإحسان» كما عرّفه رسول الله ﷺ؟',
    questionEn: 'What is the definition of "Ihsan" as taught by the Prophet (peace be upon him)?',
    optionsAr: [
      'أن تعبد الله كأنك تراه، فإن لم تكن تراه فإنه يراك',
      'أن تحفظ جميع المتون الفقهية',
      'أن تتصدق بنصف مالك كل شهر',
      'أن تصلي قيام الليل جماعة',
    ],
    optionsEn: [
      'To worship Allah as though you see Him, and if you do not see Him, know that He sees you',
      'Memorizing all legal manuals',
      'Donating half of your wealth monthly',
      'Praying night prayer in congregation',
    ],
    correctIndex: 0,
    explanationAr: 'الإحسان هو أعلى مراتب الدين؛ ومراقبة الله تعالى في السر والعلن واستحضار نظره سبحانه في كل عبادة ومعاملة.',
    explanationEn: 'Ihsan is the highest rank of faith: mindfulness of Allah in private and public, knowing He watches over every action.',
    sourceAr: 'متفق عليه · البخاري (٥٠) ومسلم (٨)',
    sourceEn: 'Agreed Upon · Bukhari (50) & Muslim (8)',
    points: 20,
  },
  {
    id: 'aq_05',
    subject: 'aqeedah',
    questionAr: 'ما الكلمة التي بعث الله بها جميع الرسل من أولهم إلى آخرهم؟',
    questionEn: 'What fundamental message were all Messengers sent with from the first to the last?',
    optionsAr: [
      'تأسيس الدول والممالك فقط',
      'اعبدوا الله واجتنبوا الطاغوت',
      'جمع الأموال وبناء القصور',
      'العزلة التامة عن المجتمعات',
    ],
    optionsEn: [
      'Establishing worldly kingdoms only',
      'Worship Allah alone and avoid all false deities (Taghut)',
      'Accumulating wealth and palaces',
      'Total isolation from society',
    ],
    correctIndex: 1,
    explanationAr: 'قال الله تعالى: ﴿وَلَقَدْ بَعَثْنَا فِي كُلِّ أُمَّةٍ رَّسُولًا أَنِ اعْبُدُوا اللَّهَ وَاجْتَنِبُوا الطَّاغُوتَ﴾ فالتوحيد دعوة كل الأنبياء.',
    explanationEn: 'Allah says in Surah an-Nahl (16:36): "And We certainly sent into every nation a messenger, [saying], Worship Allah and avoid Taghut."',
    sourceAr: 'القرآن الكريم · سورة النحل: آية ٣٦',
    sourceEn: 'Holy Quran · Surah an-Nahl 16:36',
    points: 20,
  },
  {
    id: 'aq_06',
    subject: 'aqeedah',
    questionAr: 'كيف نؤمن بأسماء الله تعالى وصفاته على منهج أهل السنة والجماعة؟',
    questionEn: 'How do Ahl al-Sunnah wal-Jamaah affirm the Names and Attributes of Allah?',
    optionsAr: [
      'بتعطيل معانيها أو نفيها',
      'بإثبات ما أثبته الله لنفسه ورسوله من غير تحريف ولا تعطيل ولا تكييف ولا تمثيل',
      'بتشبيه صفات الخالق بصفات المخلوقين',
      'بالاعتماد على التأويل العقلي المجرد دون النص',
    ],
    optionsEn: [
      'By negating their meanings entirely',
      'Affirming what Allah and His Messenger affirmed without distortion, negation, asking how, or likening to creation',
      'Likening the Creator to created beings',
      'Relying purely on speculative reinterpretation',
    ],
    correctIndex: 1,
    explanationAr: 'الأصل الجامع في باب الأسماء والصفات قوله تعالى: ﴿لَيْسَ كَمِثْلِهِ شَيْءٌ وَهُوَ السَّمِيعُ الْبَصِيرُ﴾ إثباتٌ بلا تشبيه وتنزيهٌ بلا تعطيل.',
    explanationEn: 'Guided by Surah ash-Shura (42:11): "There is nothing like unto Him, and He is the Hearing, the Seeing."',
    sourceAr: 'سورة الشورى: ١١ · منهج السلف الصالح',
    sourceEn: 'Surah ash-Shura 42:11 · Methodology of the Salaf',
    points: 20,
  },

  // ==================== QURAN (6) ====================
  {
    id: 'qr_01',
    subject: 'quran',
    questionAr: 'ما السورة التي أخبر النبي ﷺ أنها تعدل ثلث القرآن الكريم؟',
    questionEn: 'Which Surah did the Prophet (peace be upon him) state equals one-third of the Quran?',
    optionsAr: ['سورة الفلق', 'سورة الإخلاص', 'سورة العصر', 'سورة الكوثر'],
    optionsEn: ['Surah al-Falaq', 'Surah al-Ikhlas', 'Surah al-Asr', 'Surah al-Kawthar'],
    correctIndex: 1,
    explanationAr: 'تعدل سورة الإخلاص ثلث القرآن من جهة معانيها العظيمة في توحيد الله وإثبات كماله وصمديته سبحانه.',
    explanationEn: 'Surah al-Ikhlas equals a third of the Quran in reward and theme because it is wholly devoted to Pure Tawheed and Allah’s perfection.',
    sourceAr: 'صحيح البخاري (٥٠١٣) وصحيح مسلم (٨١١)',
    sourceEn: 'Sahih al-Bukhari (5013) & Sahih Muslim (811)',
    points: 20,
  },
  {
    id: 'qr_02',
    subject: 'quran',
    questionAr: 'ما أعظم آية في كتاب الله تعالى كما قرّر النبي ﷺ لأبيّ بن كعب رضي الله عنه؟',
    questionEn: 'What is the greatest Ayah in the Book of Allah as confirmed to Ubayy ibn Kaab?',
    optionsAr: [
      'آية الدَّين في سورة البقرة',
      'آية الكرسي (اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ)',
      'أول آية في سورة الحديد',
      'آخر آية في سورة الكهف',
    ],
    optionsEn: [
      'The verse of debt in Surah al-Baqarah',
      'Ayat al-Kursi (2:255)',
      'The first verse of Surah al-Hadid',
      'The last verse of Surah al-Kahf',
    ],
    correctIndex: 1,
    explanationAr: 'لما سأل النبي ﷺ أبيّ بن كعب: «أي آية في كتاب الله أعظم؟» قال: «الله لا إله إلا هو الحي القيوم»، فضرب في صدره وقال: «ليهنك العلم أبا المنذر».',
    explanationEn: 'When asked which verse in the Quran is greatest, Ubayy answered Ayat al-Kursi, and the Prophet congratulated him on his knowledge.',
    sourceAr: 'صحيح مسلم (٨١٠)',
    sourceEn: 'Sahih Muslim (810)',
    points: 20,
  },
  {
    id: 'qr_03',
    subject: 'quran',
    questionAr: 'ما السورة التي تسمّى «أم الكتاب» و«السبع المثاني» ولا تصح الصلاة بدونها؟',
    questionEn: 'Which Surah is called "Mother of the Book" and "The Seven Oft-Repeated Verses," required in every prayer?',
    optionsAr: ['سورة البقرة', 'سورة الفاتحة', 'سورة يس', 'سورة تبارك'],
    optionsEn: ['Surah al-Baqarah', 'Surah al-Fatihah', 'Surah Yasin', 'Surah al-Mulk'],
    correctIndex: 1,
    explanationAr: 'قال النبي ﷺ: «لا صلاة لمن لم يقرأ بفاتحة الكتاب»، وهي أعظم سورة في القرآن الكريم.',
    explanationEn: 'The Prophet (peace be upon him) said: "There is no prayer for the one who does not recite the Opening of the Book (al-Fatihah)."',
    sourceAr: 'متفق عليه · البخاري (٧٥٦) ومسلم (٣٩٤)',
    sourceEn: 'Agreed Upon · Bukhari (756) & Muslim (394)',
    points: 20,
  },
  {
    id: 'qr_04',
    subject: 'quran',
    questionAr: 'ما السورة التي أخبر النبي ﷺ أن قراءتها يوم الجمعة تضيء للمسلم نوراً ما بين الجمعتين؟',
    questionEn: 'Reading which Surah on Friday illuminates a light for the believer between the two Fridays?',
    optionsAr: ['سورة الكهف', 'سورة الدخان', 'سورة الواقعة', 'سورة الرحمن'],
    optionsEn: ['Surah al-Kahf', 'Surah ad-Dukhan', 'Surah al-Waqiah', 'Surah ar-Rahman'],
    correctIndex: 0,
    explanationAr: 'ثبت في السنة الحث على قراءة سورة الكهف يوم الجمعة، وفيها أعظم القصص والعبر للنجاة من الفتن.',
    explanationEn: 'Authentic narrations recommend reciting Surah al-Kahf on Fridays, containing timeless lessons against major trials.',
    sourceAr: 'مستدرك الحاكم (٢/٣٩٩) والبيهقي وصححه الألباني في صحيح الجامع (٦٤٧٠)',
    sourceEn: 'Al-Hakim & al-Bayhaqi · Graded Sahih by al-Albani (6470)',
    points: 20,
  },
  {
    id: 'qr_05',
    subject: 'quran',
    questionAr: 'ما السورة المنجّية من عذاب القبر التي تشفع لصاحبها ثلاثين آية؟',
    questionEn: 'Which thirty-verse Surah intercedes for its reciter and protects from the punishment of the grave?',
    optionsAr: ['سورة الملك (تبارك)', 'سورة السجدة', 'سورة ق', 'سورة النبأ'],
    optionsEn: ['Surah al-Mulk (Tabarak)', 'Surah as-Sajdah', 'Surah Qaf', 'Surah an-Naba'],
    correctIndex: 0,
    explanationAr: 'قال النبي ﷺ: «إن سورة من القرآن ثلاثون آية شفعت لرجل حتى غُفر له، وهي سورة تبارك الذي بيده الملك».',
    explanationEn: 'The Prophet said: "A Surah from the Quran containing thirty verses interceded for a man until he was forgiven: Tabarak alladhi biyadihil-Mulk."',
    sourceAr: 'سنن أبي داود (١٤٠٠) والترمذي (٢٨٩١) وحسنه الألباني',
    sourceEn: 'Abu Dawud (1400) & at-Tirmidhi (2891)',
    points: 20,
  },
  {
    id: 'qr_06',
    subject: 'quran',
    questionAr: 'ما السورة الوحيدة في القرآن الكريم التي لم تبدأ بـ «بسم الله الرحمن الرحيم»؟',
    questionEn: 'Which is the only Surah in the Noble Quran that does not begin with Bismillah?',
    optionsAr: ['سورة الأنفال', 'سورة التوبة (براءة)', 'سورة النمل', 'سورة الحج'],
    optionsEn: ['Surah al-Anfal', 'Surah at-Tawbah', 'Surah an-Naml', 'Surah al-Hajj'],
    correctIndex: 1,
    explanationAr: 'سورة التوبة لم تُكتب البسملة في أولها، وقد عُوضت البسملة في وسط سورة النمل في قصة سليمان عليه السلام: ﴿إِنَّهُ مِن سُلَيْمَانَ وَإِنَّهُ بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ﴾.',
    explanationEn: 'Surah at-Tawbah begins without Bismillah, while Bismillah appears twice inside Surah an-Naml.',
    sourceAr: 'القرآن الكريم · سورة التوبة وسورة النمل: آية ٣٠',
    sourceEn: 'Holy Quran · Surah at-Tawbah & Surah an-Naml 27:30',
    points: 20,
  },

  // ==================== HADITH & SEERAH (6) ====================
  {
    id: 'hs_01',
    subject: 'hadith_seerah',
    questionAr: 'من هو الصحابي الملقب بـ «ترجمان القرآن» وحبر الأمة؟',
    questionEn: 'Which Companion was given the title "Interpreter of the Quran" (Tarjuman al-Quran)?',
    optionsAr: [
      'زيد بن ثابت رضي الله عنه',
      'عبد الله بن عباس رضي الله عنهما',
      'أبو هريرة رضي الله عنه',
      'سعد بن معاذ رضي الله عنه',
    ],
    optionsEn: [
      'Zayd ibn Thabit',
      'Abdullah ibn Abbas',
      'Abu Hurayrah',
      'Saad ibn Muadh',
    ],
    correctIndex: 1,
    explanationAr: 'دعا النبي ﷺ لعبد الله بن عباس قائلاً: «اللهم فقهه في الدين وعلمه التأويل»، فصار ترجمان القرآن وحبر هذه الأمة.',
    explanationEn: 'The Prophet supplicated for Ibn Abbas: "O Allah, grant him deep understanding of the religion and teach him Tafsir."',
    sourceAr: 'صحيح البخاري (٧٥) ومسند أحمد (٢٣٩٧)',
    sourceEn: 'Sahih al-Bukhari (75) & Musnad Ahmad (2397)',
    points: 20,
  },
  {
    id: 'hs_02',
    subject: 'hadith_seerah',
    questionAr: 'في أي سنة للهجرة وقعت غزوة بدر الكبرى التي سماها الله «يوم الفرقان»؟',
    questionEn: 'In which year of the Hijrah did the Battle of Badr ("The Day of Criterion") take place?',
    optionsAr: ['السنة الأولى للهجرة', 'السنة الثانية للهجرة', 'السنة الخامسة للهجرة', 'السنة الثامنة للهجرة'],
    optionsEn: ['1st year AH', '2nd year AH', '5th year AH', '8th year AH'],
    correctIndex: 1,
    explanationAr: 'وقعت غزوة بدر الكبرى في السابع عشر من رمضان في السنة الثانية للهجرة، ونصر الله فيها المؤمنين القلّة على أهل الشرك.',
    explanationEn: 'The Battle of Badr occurred on 17th Ramadan in the 2nd year AH, where Allah granted victory to the believers.',
    sourceAr: 'سورة الأنفال: ٤١ · السيرة النبوية الصحيحة',
    sourceEn: 'Surah al-Anfal 8:41 · Authentic Seerah',
    points: 20,
  },
  {
    id: 'hs_03',
    subject: 'hadith_seerah',
    questionAr: 'ما أول حديث افتتح به الإمام البخاري صحيحه ويدل على ميزان النيات؟',
    questionEn: 'What is the very first hadith with which Imam al-Bukhari opened his Sahih?',
    optionsAr: [
      '«الدين النصيحة»',
      '«إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى»',
      '«بُني الإسلام على خمس»',
      '«من سلك طريقاً يلتمس فيه علماً»',
    ],
    optionsEn: [
      'Religion is sincere advice',
      'Actions are only by intentions, and every person shall have what they intended',
      'Islam is built upon five pillars',
      'Whoever treads a path seeking knowledge',
    ],
    correctIndex: 1,
    explanationAr: 'حديث عمر بن الخطاب رضي الله عنه: «إنما الأعمال بالنيات» أصل عظيم يدخل في جميع أبواب الدين والعبادات.',
    explanationEn: 'Narrated by Umar ibn al-Khattab, this foundational hadith governs every act of worship and daily life.',
    sourceAr: 'صحيح البخاري (١) وصحيح مسلم (١٩٠٧)',
    sourceEn: 'Sahih al-Bukhari (1) & Sahih Muslim (1907)',
    points: 20,
  },
  {
    id: 'hs_04',
    subject: 'hadith_seerah',
    questionAr: 'كم كان عمر النبي ﷺ عندما نزل عليه الوحي أول مرة في غار حراء؟',
    questionEn: 'How old was the Prophet Muhammad (peace be upon him) when revelation first began at Cave Hira?',
    optionsAr: ['٢٥ عاماً', '٣٥ عاماً', '٤٠ عاماً', '٤٥ عاماً'],
    optionsEn: ['25 years old', '35 years old', '40 years old', '45 years old'],
    correctIndex: 2,
    explanationAr: 'بعث الله نبيه محمداً ﷺ على رأس أربعين سنة بالرسالة، فمكث في مكة ثلاث عشرة سنة يدعو إلى التوحيد ثم هاجر إلى المدينة.',
    explanationEn: 'Allah commissioned him with Prophethood at age 40; he called to Tawheed in Makkah for 13 years before migrating to Madinah.',
    sourceAr: 'صحيح البخاري (٣٥٤٧) وصحيح مسلم (٢٣٤٧)',
    sourceEn: 'Sahih al-Bukhari (3547) & Sahih Muslim (2347)',
    points: 20,
  },
  {
    id: 'hs_05',
    subject: 'hadith_seerah',
    questionAr: 'ما الثلاثة التي لا ينقطع أجرها عن ابن آدم بعد موته كما في الحديث الصحيح؟',
    questionEn: 'What are the three deeds whose reward continues after a person passes away?',
    optionsAr: [
      'الصدقة الجارية، والعلم الذي يُنتفع به، والولد الصالح يدعو له',
      'بناء المنازل، وجمع الذهب، والشهرة',
      'السفر، والتجارة، وكثرة الكلام',
      'حفظ الأشعار، والأنساب، والمدائح',
    ],
    optionsEn: [
      'Ongoing charity (Sadaqah Jariyah), beneficial knowledge, and a righteous child who prays for them',
      'Building mansions, hoarding gold, and fame',
      'Travel, trade, and abundant speech',
      'Memorizing poetry and lineages',
    ],
    correctIndex: 0,
    explanationAr: 'قال رسول الله ﷺ: «إذا مات الإنسان انقطع عنه عمله إلا من ثلاثة: إلا من صدقة جارية، أو علم ينتفع به، أو ولد صالح يدعو له».',
    explanationEn: 'The Prophet said: "When a person dies, all their deeds end except three: ongoing charity, beneficial knowledge, or a righteous child praying for them."',
    sourceAr: 'صحيح مسلم (١٦٣١) من حديث أبي هريرة رضي الله عنه',
    sourceEn: 'Sahih Muslim (1631) · Abu Hurayrah',
    points: 20,
  },
  {
    id: 'hs_06',
    subject: 'hadith_seerah',
    questionAr: 'من الصحابي الجليل الذي قال له النبي ﷺ: «أنت مني بمنزلة هارون من موسى إلا أنه لا نبي بعدي»؟',
    questionEn: 'To which Companion did the Prophet say: "You are to me like Harun was to Musa, except there is no prophet after me"?',
    optionsAr: [
      'أبو بكر الصديق رضي الله عنه',
      'علي بن أبي طالب رضي الله عنه',
      'عثمان بن عفان رضي الله عنه',
      'عمر بن الخطاب رضي الله عنه',
    ],
    optionsEn: [
      'Abu Bakr as-Siddiq',
      'Ali ibn Abi Talib',
      'Uthman ibn Affan',
      'Umar ibn al-Khattab',
    ],
    correctIndex: 1,
    explanationAr: 'قالها النبي ﷺ لعلي بن أبي طالب رضي الله عنه حين استخلفه على المدينة في غزوة تبوك.',
    explanationEn: 'The Prophet spoke these words to Ali ibn Abi Talib when leaving him in charge of Madinah during the expedition to Tabuk.',
    sourceAr: 'متفق عليه · البخاري (٤٤١٦) ومسلم (٢٤٠٤)',
    sourceEn: 'Agreed Upon · Bukhari (4416) & Muslim (2404)',
    points: 20,
  },

  // ==================== FIQH & WORSHIP (6) ====================
  {
    id: 'fq_01',
    subject: 'fiqh',
    questionAr: 'ما عدد فروض الوضوء المذكورة في آية المائدة: ﴿يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا قُمْتُمْ إِلَى الصَّلَاةِ...﴾؟',
    questionEn: 'How many obligatory limbs/acts of Wudu are directly mentioned in Surah al-Maidah (5:6)?',
    optionsAr: [
      'ثلاثة فروض',
      'أربعة فروض (الوجه، اليدين إلى المرفقين، مسح الرأس، الرجلين إلى الكعبين)',
      'عشرة فروض',
      'ستة عشر فرضاً',
    ],
    optionsEn: [
      'Three obligations',
      'Four obligations (face, arms to elbows, wiping head, feet to ankles)',
      'Ten obligations',
      'Sixteen obligations',
    ],
    correctIndex: 1,
    explanationAr: 'ذكرت الآية الكريمة أربعة أعضاء أساسية في الوضوء، وأضاف العلماء النية والترتيب والموالاة وفق السنة الصحيحة.',
    explanationEn: 'Surah al-Maidah 5:6 explicitly specifies washing the face, arms up to the elbows, wiping the head, and washing the feet up to the ankles.',
    sourceAr: 'سورة المائدة: آية ٦',
    sourceEn: 'Surah al-Maidah 5:6',
    points: 20,
  },
  {
    id: 'fq_02',
    subject: 'fiqh',
    questionAr: 'ما أول ما يُحاسب عليه العبد يوم القيامة من عمله كما ثبت في السنن؟',
    questionEn: 'What is the very first deed a servant will be held accountable for on the Day of Judgment?',
    optionsAr: ['الصلاة', 'النفقات التجارية', 'أنساب القبائل', 'زيارة الأصدقاء'],
    optionsEn: ['The Prayer (Salah)', 'Business transactions', 'Tribal lineages', 'Visiting friends'],
    correctIndex: 0,
    explanationAr: 'قال النبي ﷺ: «إن أول ما يحاسب به العبد يوم القيامة من عمله صلاته، فإن صلحت فقد أفلح وأنجح، وإن فسدت فقد خاب وخسر».',
    explanationEn: 'The Prophet said: "The first thing the servant will be called to account for on the Day of Resurrection is his prayer."',
    sourceAr: 'سنن الترمذي (٤١٣) والنسائي (٤٦٥) وصححه الألباني',
    sourceEn: 'Sunan at-Tirmidhi (413) & an-Nasai (465)',
    points: 20,
  },
  {
    id: 'fq_03',
    subject: 'fiqh',
    questionAr: 'ما النصاب الشرعي لوجوب زكاة الذهب عند أهل العلم؟',
    questionEn: 'What is the minimum threshold (Nisab) for Zakah to become obligatory on gold?',
    optionsAr: ['٢٠ جراماً', '٥٠ جراماً', '٨٥ جراماً (٢٠ مثقالاً)', '٢٠٠ جرام'],
    optionsEn: ['20 grams', '50 grams', '85 grams (20 Mithqal)', '200 grams'],
    correctIndex: 2,
    explanationAr: 'نصاب الذهب عشرون ديناراً (مثقالاً)، ويُقدر بنحو ٨٥ جراماً من الذهب الخالص إذا حال عليه الحول، ومقدار الزكاة ربع العشر (٢.٥٪).',
    explanationEn: 'The Nisab of gold is 20 dinars (~85g of pure gold) held for one full lunar year, with 2.5% due in Zakah.',
    sourceAr: 'سنن أبي داود (١٥٧٣) وإجماع الفقهاء',
    sourceEn: 'Sunan Abu Dawud (1573) & Scholarly Consensus',
    points: 20,
  },
  {
    id: 'fq_04',
    subject: 'fiqh',
    questionAr: 'ما الساعات التي نُهي عن صلاة النافلة المطلقة فيها؟',
    questionEn: 'During which periods is general voluntary prayer prohibited?',
    optionsAr: [
      'أوقات النهي (بعد الفجر حتى ترتفع الشمس، عند الاستواء، وبعد العصر حتى الغروب)',
      'أثناء الليل بعد منتصفه',
      'بين الظهر والعصر',
      'بعد صلاة العشاء',
    ],
    optionsEn: [
      'The prohibited times (after Fajr until sunrise rises, zenith, and after Asr until sunset)',
      'After midnight',
      'Between Dhuhr and Asr',
      'After Isha prayer',
    ],
    correctIndex: 0,
    explanationAr: 'نهى النبي ﷺ عن الصلاة في هذه الأوقات الثلاثة وما يتبعها من نهي للنافلة المطلقة، ويُستثنى ذوات الأسباب كتحية المسجد وقضاء الفوائت على الراجح.',
    explanationEn: 'General voluntary prayers are avoided during those three time windows, while prayers with an immediate cause (like Tahiyyat al-Masjid) remain valid according to scholars.',
    sourceAr: 'صحيح مسلم (٨٣١) من حديث عقبة بن عامر رضي الله عنه',
    sourceEn: 'Sahih Muslim (831) · Uqbah ibn Amir',
    points: 20,
  },
  {
    id: 'fq_05',
    subject: 'fiqh',
    questionAr: 'ما أجر صيام يوم عرفة لغير الحاج كما صحّ عن رسول الله ﷺ؟',
    questionEn: 'What is the reward for fasting the Day of Arafah (9th Dhul-Hijjah) for non-pilgrims?',
    optionsAr: [
      'يكفر السنة الماضية والباقية',
      'يكفر سنة واحدة فقط',
      'يعادل أجر عشرة أيام فقط',
      'لا يُشرع صيامه لغير الحاج',
    ],
    optionsEn: [
      'It expiates the sins of the previous year and the coming year',
      'It expiates one year only',
      'Equals ten days of charity',
      'It is discouraged for non-pilgrims',
    ],
    correctIndex: 0,
    explanationAr: 'قال النبي ﷺ: «صيام يوم عرفة أحتسب على الله أن يكفّر السنة التي قبله والسنة التي بعده».',
    explanationEn: 'The Prophet (peace be upon him) said: "Fasting the day of Arafah, I hope from Allah that it expiates the sins of the year before it and the year after it."',
    sourceAr: 'صحيح مسلم (١١٦٢) من حديث أبي قتادة رضي الله عنه',
    sourceEn: 'Sahih Muslim (1162) · Abu Qatadah',
    points: 20,
  },
  {
    id: 'fq_06',
    subject: 'fiqh',
    questionAr: 'ما عدد ركعات السنن الرواتب المؤكدة في اليوم والليلة التي يُبنى بها بيت في الجنة؟',
    questionEn: 'How many daily regular Sunnah prayer units (Rawatib) earn the promise of a house in Paradise?',
    optionsAr: ['٦ ركعات', '٨ ركعات', '١٢ ركعة', '٢٠ ركعة'],
    optionsEn: ['6 rakahs', '8 rakahs', '12 rakahs', '20 rakahs'],
    correctIndex: 2,
    explanationAr: 'هي ١٢ ركعة: أربع قبل الظهر وركعتان بعدها، وركعتان بعد المغرب، وركعتان بعد العشاء، وركعتان قبل الفجر.',
    explanationEn: 'They are 12 rakahs daily: 4 before Dhuhr and 2 after, 2 after Maghrib, 2 after Isha, and 2 before Fajr.',
    sourceAr: 'صحيح مسلم (٧٢٨) وسنن الترمذي (٤١٥)',
    sourceEn: 'Sahih Muslim (728) & at-Tirmidhi (415)',
    points: 20,
  },

  // ==================== AKHLAQ & TAZKIYAH (6) ====================
  {
    id: 'ak_01',
    subject: 'akhlaq',
    questionAr: 'ما أثقل شيء يُوضع في ميزان العبد المؤمن يوم القيامة كما صحّ عن النبي ﷺ؟',
    questionEn: 'What is the heaviest thing placed on the believer’s scale on the Day of Judgment?',
    optionsAr: ['كثرة الأموال', 'حُسن الخُلُق', 'فصاحة اللسان', 'المناصب الدنيوية'],
    optionsEn: ['Abundant wealth', 'Good character (Husn al-Khuluq)', 'Eloquence', 'Worldly status'],
    correctIndex: 1,
    explanationAr: 'قال النبي ﷺ: «ما شيء أثقل في ميزان المؤمن يوم القيامة من خُلُق حسن، وإن الله ليبغض الفاحش البذيء».',
    explanationEn: 'The Prophet said: "Nothing is heavier on the believer’s scale on the Day of Resurrection than good character."',
    sourceAr: 'سنن الترمذي (٢٠٠٢) وأبو داود (٤٧٩٩) وصححه الألباني',
    sourceEn: 'Sunan at-Tirmidhi (2002) & Abu Dawud (4799)',
    points: 20,
  },
  {
    id: 'ak_02',
    subject: 'akhlaq',
    questionAr: 'من هو «الشديد» حقاً كما عرّفه رسول الله ﷺ؟',
    questionEn: 'Who is truly strong according to the Prophet Muhammad (peace be upon him)?',
    optionsAr: [
      'الذي يغلب الناس في الصراع',
      'الذي يملك نفسه عند الغضب',
      'الذي يرفع صوته في المجالس',
      'الذي يرد الإساءة بمثلها دائماً',
    ],
    optionsEn: [
      'One who defeats others in wrestling',
      'One who controls himself when angry',
      'One who raises his voice in gatherings',
      'One who always retaliates harshly',
    ],
    correctIndex: 1,
    explanationAr: 'قال النبي ﷺ: «ليس الشديد بالصُّرَعة، إنما الشديد الذي يملك نفسه عند الغضب».',
    explanationEn: 'The Prophet said: "The strong person is not the one who overcomes others in wrestling; rather, the strong person is the one who controls himself when angry."',
    sourceAr: 'متفق عليه · البخاري (٦١١٤) ومسلم (٢٦٠٩)',
    sourceEn: 'Agreed Upon · Bukhari (6114) & Muslim (2609)',
    points: 20,
  },
  {
    id: 'ak_03',
    subject: 'akhlaq',
    questionAr: 'ما خصلة الإيمان في تعامل المسلم مع جاره كما أوصى النبي ﷺ؟',
    questionEn: 'What behavior toward one’s neighbor did the Prophet tie directly to complete faith?',
    optionsAr: [
      'مقاطعة الجار وعدم السلام عليه',
      'إكرام الجار وكفّ الأذى عنه',
      'التجسس على أخبار الجيران',
      'التفاخر عليه بالبنيان',
    ],
    optionsEn: [
      'Ignoring the neighbor completely',
      'Honoring the neighbor and refraining from harming him',
      'Prying into neighbors’ private affairs',
      'Boasting over them',
    ],
    correctIndex: 1,
    explanationAr: 'قال النبي ﷺ: «من كان يؤمن بالله واليوم الآخر فليكرم جاره»، وأوصى جبريل بالجار حتى ظن النبي ﷺ أنه سيورثه.',
    explanationEn: 'The Prophet said: "Whoever believes in Allah and the Last Day, let him honor his neighbor."',
    sourceAr: 'متفق عليه · البخاري (٦٠١٨) ومسلم (٤٧)',
    sourceEn: 'Agreed Upon · Bukhari (6018) & Muslim (47)',
    points: 20,
  },
  {
    id: 'ak_04',
    subject: 'akhlaq',
    questionAr: 'ما الكلمة الطيبة التي تُدخل في باب الصدقة كل يوم دون إنفاق مال؟',
    questionEn: 'Which effortless daily habit counts as charity even without spending money?',
    optionsAr: [
      'الغيبة في المجالس',
      'تبسّمك في وجه أخيك والكلمة الطيبة',
      'الجدال والمراء العقيم',
      'إهمال إصلاح ذات البين',
    ],
    optionsEn: [
      'Gossiping in gatherings',
      'Smiling at your brother and speaking a kind word',
      'Argue endlessly over trivialities',
      'Neglecting reconciliation',
    ],
    correctIndex: 1,
    explanationAr: 'قال النبي ﷺ: «تبسّمك في وجه أخيك لك صدقة...»، وقال أيضاً: «والكلمة الطيبة صدقة».',
    explanationEn: 'The Prophet taught: "Your smile in the face of your brother is charity," and "A good word is charity."',
    sourceAr: 'متفق عليه (٢٩٨٩) وسنن الترمذي (١٩٥٦)',
    sourceEn: 'Sahih al-Bukhari (2989) & at-Tirmidhi (1956)',
    points: 20,
  },
  {
    id: 'ak_05',
    subject: 'akhlaq',
    questionAr: 'ما دعاء النبي ﷺ الجامع في حسن الخلق وتزكية النفس؟',
    questionEn: 'How did the Prophet supplicate regarding character and inner beauty?',
    optionsAr: [
      '«اللهم كما حسّنت خَلقي فحسّن خُلُقي»',
      '«اللهم أكثر أموالي وأبعدني عن الناس»',
      '«اللهم اجعلني أغنى من جيراني»',
      'لا يوجد دعاء مأثور في الأخلاق',
    ],
    optionsEn: [
      '"O Allah, just as You made my physical form good, make my character good"',
      '"O Allah, isolate me from everyone"',
      '"O Allah, make me richer than my neighbors"',
      'No prophetic supplication exists for character',
    ],
    correctIndex: 0,
    explanationAr: 'كان من دعائه ﷺ سؤال الله حسن الخلق والهدى والتقى والعفاف والغنى؛ لأن صلاح القلب ينعكس على اللسان والجوارح.',
    explanationEn: 'He frequently asked Allah to perfect his character alongside guidance, piety, chastity, and contentment.',
    sourceAr: 'مسند أحمد (٢٤٣٩٢) وصححه الألباني في إرواء الغليل (٧٤)',
    sourceEn: 'Musnad Ahmad (24392) · Graded Sahih by al-Albani',
    points: 20,
  },
  {
    id: 'ak_06',
    subject: 'akhlaq',
    questionAr: 'ما أثر «الصدق» في هداية المسلم كما أخبر النبي ﷺ؟',
    questionEn: 'What does truthfulness (Sidq) ultimately lead a believer toward according to Hadith?',
    optionsAr: [
      'الصدق يهدي إلى البر، والبر يهدي إلى الجنة',
      'الصدق يُذهب هيبة الإنسان',
      'الصدق مقتصر على التجارة فقط',
      'الصدق يضعف الروابط الاجتماعية',
    ],
    optionsEn: [
      'Truthfulness leads to righteousness, and righteousness leads to Paradise',
      'Truthfulness diminishes dignity',
      'Truthfulness only applies to trade',
      'Truthfulness weakens social ties',
    ],
    correctIndex: 0,
    explanationAr: 'قال النبي ﷺ: «عليكم بالصدق؛ فإن الصدق يهدي إلى البر، وإن البر يهدي إلى الجنة، وما يزال الرجل يصدق ويتحرى الصدق حتى يُكتب عند الله صديقاً».',
    explanationEn: 'The Prophet said: "Adhere to truthfulness, for truthfulness leads to righteousness and righteousness leads to Paradise."',
    sourceAr: 'متفق عليه · البخاري (٦٠٩٤) ومسلم (٢٦٠٧)',
    sourceEn: 'Agreed Upon · Bukhari (6094) & Muslim (2607)',
    points: 20,
  },
];

function hashDateSeed(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i += 1) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Deterministically picks 5 balanced daily questions (one from each Islamic subject)
 * so every day features a complete, cohesive 5-question round for all visitors.
 */
export function getDailyQuizQuestions(
  dateKey: string,
  extraQuestions: DawahQuizQuestion[] = [],
): DawahQuizQuestion[] {
  const combined = [...extraQuestions, ...VERIFIED_QUIZ_BANK];
  const seed = hashDateSeed(dateKey || '2026-01-01');
  const picked: DawahQuizQuestion[] = [];
  const usedIds = new Set<string>();

  for (let sIdx = 0; sIdx < DAWAH_QUIZ_SUBJECTS.length; sIdx += 1) {
    const subj = DAWAH_QUIZ_SUBJECTS[sIdx].id;
    const pool = combined.filter((q) => q.subject === subj && !usedIds.has(q.id));
    if (pool.length === 0) continue;
    const pickIdx = (seed + sIdx * 7) % pool.length;
    const chosen = pool[pickIdx];
    picked.push(chosen);
    usedIds.add(chosen.id);
  }

  return picked;
}

export function getQuizRank(totalPoints: number): {
  titleAr: string;
  titleEn: string;
  minPoints: number;
  nextPoints: number | null;
  nextTitleAr: string | null;
  nextTitleEn: string | null;
  progressPct: number;
} {
  const tiers = [
    {min: 0, titleAr: 'مبتدئ في طلب العلم', titleEn: 'Knowledge Seeker'},
    {min: 100, titleAr: 'مثابر يومي', titleEn: 'Daily Learner'},
    {min: 300, titleAr: 'طالب علم مجتهد', titleEn: 'Dedicated Student'},
    {min: 600, titleAr: 'حافظ للفوائد', titleEn: 'Preserver of Benefits'},
    {min: 1000, titleAr: 'سفير الدعوة والعلم', titleEn: 'Dawah & Knowledge Ambassador'},
  ];

  let activeIdx = 0;
  for (let i = 0; i < tiers.length; i += 1) {
    if (totalPoints >= tiers[i].min) activeIdx = i;
  }

  const current = tiers[activeIdx];
  const next = activeIdx + 1 < tiers.length ? tiers[activeIdx + 1] : null;
  const progressPct = next
    ? Math.min(100, Math.round(((totalPoints - current.min) / (next.min - current.min)) * 100))
    : 100;

  return {
    titleAr: current.titleAr,
    titleEn: current.titleEn,
    minPoints: current.min,
    nextPoints: next ? next.min : null,
    nextTitleAr: next ? next.titleAr : null,
    nextTitleEn: next ? next.titleEn : null,
    progressPct,
  };
}
