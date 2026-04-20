'use client';

import { type ReactNode, useState } from 'react';
import { resetSetupAction } from './actions';

interface HelpContentProps {
  isOwner: boolean;
}

interface SectionProps {
  id: string;
  icon: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function Section({ id, icon, title, open, onToggle, children }: SectionProps) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`section-${id}`}
        className="w-full flex items-center justify-between gap-2 p-4 hover:bg-gray-50 transition-colors text-right"
      >
        <span className="flex items-center gap-2 font-bold text-gray-900">
          <span aria-hidden className="text-xl">
            {icon}
          </span>
          {title}
        </span>
        <span
          aria-hidden
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>
      {open && (
        <div
          id={`section-${id}`}
          className="px-4 pb-4 border-t border-gray-100 text-sm text-gray-700 space-y-3 pt-3"
        >
          {children}
        </div>
      )}
    </section>
  );
}

function Step({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="shrink-0 w-7 h-7 rounded-full bg-[#f59e0b] text-black font-bold text-sm flex items-center justify-center"
      >
        {num}
      </span>
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-gray-600 text-xs mt-0.5">{children}</p>
      </div>
    </div>
  );
}

function QA({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="font-medium text-gray-900">
        <span aria-hidden className="me-2">
          ❓
        </span>
        {question}
      </p>
      <p className="mt-1 text-gray-700 text-xs leading-relaxed pe-7">
        {children}
      </p>
    </div>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="text-lg leading-none shrink-0">
        💡
      </span>
      <span>{children}</span>
    </li>
  );
}

export function HelpContent({ isOwner }: HelpContentProps) {
  const [open, setOpen] = useState<Set<string>>(new Set(['start']));

  function toggle(id: string): void {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            ❓
          </span>
          עזרה ומדריכים
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          מדריך מהיר לשימוש במערכת ניהול חכם
        </p>
      </header>

      <div className="space-y-3">
        <Section
          id="start"
          icon="🚀"
          title="איך מתחילים?"
          open={open.has('start')}
          onToggle={() => toggle('start')}
        >
          <Step num={1} title="הגדרת פרטי החברה">
            היכנס להגדרות ועדכן את שם החברה, הלוגו, הכתובת ומספר העוסק.
          </Step>
          <Step num={2} title="הגדרת סוגי ציוד">
            בהגדרות → סוגי ציוד, הוסף את סוגי הציוד שאתה עובד איתם.
          </Step>
          <Step num={3} title="הוספת רכבים ועובדים">
            הגדר את הרכבים והעובדים שלך דרך התפריט הראשי.
          </Step>
          <Step num={4} title="הוספת לקוחות">
            בהגדרות → לקוחות, הוסף את החברות שאתה עובד מולן.
          </Step>
          <Step num={5} title="התחל לרשום">
            כל יום רשום את העבודה ביומן — תאריך, לקוח, ציוד, רכב ועובדים.
          </Step>
        </Section>

        <Section
          id="daily-log"
          icon="📋"
          title="יומן עבודה"
          open={open.has('daily-log')}
          onToggle={() => toggle('daily-log')}
        >
          <QA question="איך רושמים יום עבודה?">
            לחץ על &quot;+ רישום יום עבודה&quot; בדף יומן העבודה, בחר תאריך,
            לקוח, ציוד ורכב (אופציונלי). המחיר מתמלא אוטומטית לפי סעד הלקוח.
          </QA>
          <QA question="איך מוסיפים עובדים ליום?">
            בתוך הרישום, בקטע &quot;עובדים ביום זה&quot; לחץ על &quot;+ הוסף
            עובד&quot; ובחר מהרשימה. השכר וההכנסה מתמלאים אוטומטית לפי
            הסעדים.
          </QA>
          <QA question="מה ההבדל בין טיוטה, מאושר וחשבונית?">
            טיוטה = ניתן לערוך בחופשיות. מאושר = הרישום נסגר ומוכן להכללה
            בחשבונית. חשבונית = כבר נכלל בחשבונית שהופקה.
          </QA>
          <QA question="למה חשוב לאשר רישומים?">
            רק רישומים מאושרים נכנסים לחישוב הרווח בדוחות, וניתן להפיק מהם
            חשבוניות. טיוטות לא נחשבות הכנסה בפועל.
          </QA>
        </Section>

        <Section
          id="invoices"
          icon="📄"
          title="חשבוניות"
          open={open.has('invoices')}
          onToggle={() => toggle('invoices')}
        >
          <QA question="איך מפיקים חשבונית חודשית?">
            בדף חשבוניות לחץ על &quot;+ הפק חשבונית חודשית&quot;, בחר לקוח
            ותקופה, המערכת תאסוף את כל הרישומים המאושרים באותה תקופה ותחשב
            את הסכום כולל מע״מ.
          </QA>
          <QA question="מה קורה כשמבטלים חשבונית?">
            הרישומים המשויכים חוזרים לסטטוס &quot;מאושר&quot; וניתן להפיק
            חשבונית חדשה עבורם. פעולה זו הפיכה.
          </QA>
          <QA question="איך רושמים תשלום?">
            ליד חשבונית בסטטוס &quot;נשלחה&quot; לחץ על &quot;רישום
            תשלום&quot; והזן את הסכום והתאריך. לו הסכום שווה ליתרה — הסטטוס
            יהפוך ל&quot;שולמה&quot;, אחרת &quot;שולמה חלקית&quot;.
          </QA>
        </Section>

        <Section
          id="finance"
          icon="🏦"
          title="כספים"
          open={open.has('finance')}
          onToggle={() => toggle('finance')}
        >
          <QA question="מהו תזרים מזומנים?">
            חיזוי של הכנסות וההוצאות הצפויות בשבועות הקרובים — כולל שיקים
            דחויים, הוראות קבע, חיובי אשראי וחשבוניות ממתינות. מסייע לתכנן
            מראש.
          </QA>
          <QA question="איך עושים התאמת בנק?">
            בדף התאמת בנק, בחר חשבון והזן את היתרה כפי שהיא מופיעה בדף
            החשבון מהבנק. המערכת תציג את היתרה במערכת ואת הפער (אם קיים).
          </QA>
          <QA question="איך מנהלים שיקים?">
            בדף שיקים ניתן להוסיף שיקים יוצאים (שאתה מוציא) ושיקים נכנסים
            (שאתה מקבל), ולעדכן את הסטטוס (ממתין, הופקד, נפרע, חזר, בוטל).
          </QA>
          <QA question="מהי הוראת קבע?">
            תשלום חוזר בתדירות קבועה — שבועי, חודשי, דו-חודשי, רבעוני או
            שנתי. המערכת מחשבת אוטומטית את התאריך הבא לחיוב.
          </QA>
        </Section>

        <Section
          id="budget"
          icon="📊"
          title="תקציב"
          open={open.has('budget')}
          onToggle={() => toggle('budget')}
        >
          <QA question="איך מגדירים תקציב?">
            בדף תקציב לחץ על &quot;עדכן תקציב&quot; והזן את הסכומים
            המתוכננים לכל סעיף הכנסה או הוצאה — לשנה שלמה או לחודש בודד.
          </QA>
          <QA question="מה זה תקציב מול ביצוע?">
            השוואה בין הסכומים שתכננת לבין מה שקרה בפועל. שריטי התקדמות
            צבעוניים מראים מיד אם חרגת מהתקציב או נמצא בתוכו.
          </QA>
          <QA question="למה חשוב לעקוב אחרי התקציב?">
            כדי לזהות חריגות בהוצאות מוקדם, לשמור על רווחיות, ולתכנן טוב
            יותר את החודשים הבאים.
          </QA>
        </Section>

        <Section
          id="reports"
          icon="📈"
          title="דוחות"
          open={open.has('reports')}
          onToggle={() => toggle('reports')}
        >
          <QA question="אילו דוחות זמינים?">
            דוח רווח והפסד, דוח רואה חשבון, דוח דלק, דוח עובדים, תמחור חכם
            (עלות אמיתית לרכב), ודוח תקציב שנתי.
          </QA>
          <QA question="איך מדפיסים דוח?">
            בכל דוח יש כפתור &quot;הדפס&quot; שפותח את תיבת ההדפסה של
            הדפדפן. משם ניתן לשמור כ-PDF באמצעות בחירת יעד &quot;Save as
            PDF&quot;.
          </QA>
          <QA question="מהו תמחור חכם?">
            ניתוח העלות האמיתית של כל יום עבודה לרכב — כולל דלק, ביטוח,
            רישיון ותחזוקה. מראה אם המחיר שגובים מלקוח מכסה את העלות ואם
            הרכב רווחי.
          </QA>
        </Section>

        <Section
          id="tips"
          icon="✨"
          title="טיפים"
          open={open.has('tips')}
          onToggle={() => toggle('tips')}
        >
          <ul className="space-y-2">
            <Tip>רשום כל יום — אל תצבור ימים של רישומים לסוף החודש.</Tip>
            <Tip>אשר רישומים בסוף כל שבוע כדי לסגור אותם.</Tip>
            <Tip>הגדר תקציב ועקוב אחריו כדי לשמור על רווחיות.</Tip>
            <Tip>בצע התאמת בנק אחת לחודש לוודא שהכל מסתדר.</Tip>
            <Tip>בדוק את התזרים פעם בשבוע לתכנון טוב יותר.</Tip>
          </ul>
        </Section>
      </div>

      {isOwner && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="font-bold text-gray-900">איפוס הגדרות</h2>
          <p className="mt-1 text-xs text-gray-600">
            הפעלה מחדש של אשף ההגדרות תאפשר לך לעדכן את הפרטים הבסיסיים של
            החברה. הנתונים הקיימים (רכבים, עובדים, לקוחות, רישומים) יישמרו.
          </p>
          <form action={resetSetupAction} className="mt-3">
            <button
              type="submit"
              className="px-4 py-2 rounded-md border border-red-300 text-red-700 font-medium text-sm hover:bg-red-50 transition-colors"
            >
              הפעל מחדש את אשף ההגדרות
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
