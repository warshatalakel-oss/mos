
import React from 'react';
import type { ClassData, SchoolSettings, Student } from '../../types.ts';

interface PrimaryOralExamPDFPageProps {
    settings: SchoolSettings;
    logos: { school: string | null; ministry: string | null };
    students: Student[];
    classData: ClassData;
    startingIndex: number;
}

const ROWS_PER_PAGE = 21;

const LiftedContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ position: 'relative', bottom: '5px' }}>{children}</div>
);

export default function PrimaryOralExamPDFPage({ settings, logos, students, classData, startingIndex }: PrimaryOralExamPDFPageProps) {
    const displayRows = [...students];
    while (displayRows.length < ROWS_PER_PAGE) {
        displayRows.push(null as any);
    }

    const subjects = [
        'التربية الاسلامية',
        'اللغة العربية',
        'اللغة الانكليزية',
        'الرياضيات',
        'العلوم',
        'الفنية والنشيد',
        'التربية الرياضية'
    ];

    return (
        <div className="w-[794px] h-[1123px] p-6 bg-white font-['Cairo'] flex flex-col" dir="rtl">
            <header className="flex justify-between items-start mb-4">
                <div className="w-1/3 text-right space-y-0.5">
                    <p className="font-bold text-base">ادارة مدرسة</p>
                    <p className="font-bold text-lg">{settings.schoolName}</p>
                </div>
                <div className="w-1/3 text-center">
                    <h1 className="text-xl font-bold">قائمة درجات امتحانات نهاية السنة</h1>
                    <p className="text-base mt-0.5 font-semibold">للعام الدراسي {settings.academicYear}</p>
                </div>
                <div className="w-1/3 text-left space-y-0.5">
                    <p className="font-bold text-base">الصف والشعبة / {classData.stage} {classData.section}</p>
                </div>
            </header>

            <main className="flex-grow">
                <table className="w-full border-collapse border-2 border-black">
                    <thead>
                        <tr className="text-center font-bold text-xs h-12">
                            <th rowSpan={2} className="border-2 border-black w-[4%]"><LiftedContent>ت</LiftedContent></th>
                            <th rowSpan={2} className="border-2 border-black w-[26%]"><LiftedContent>اسم التلميذ الثلاثي</LiftedContent></th>
                            {subjects.map((sub, idx) => (
                                <th key={idx} rowSpan={2} className="border-2 border-black p-0 h-28 align-middle" style={{ width: '6.5%' }}>
                                    <div className="h-full w-full flex items-center justify-center relative">
                                        <div className="transform -rotate-90 whitespace-nowrap text-center text-[10px]">
                                            {sub}
                                        </div>
                                    </div>
                                </th>
                            ))}
                            <th colSpan={2} className="border-2 border-black w-[16%] h-6"><LiftedContent>المجموع</LiftedContent></th>
                            <th rowSpan={2} className="border-2 border-black w-[10%]"><LiftedContent>النتيجة</LiftedContent></th>
                        </tr>
                        <tr className="text-center font-bold text-[10px] h-6">
                            <th className="border-2 border-black w-[8%]"><LiftedContent>رقماً</LiftedContent></th>
                            <th className="border-2 border-black w-[8%]"><LiftedContent>كتابة</LiftedContent></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((student, index) => (
                            <tr key={student ? student.id : `empty-${index}`} className="h-[38px]">
                                <td className="border-2 border-black text-center font-bold text-sm">
                                    <div style={{ position: 'relative', bottom: '4px' }}>{startingIndex + index + 1}</div>
                                </td>
                                <td className="border-2 border-black px-1.5 text-right font-bold text-[15px] whitespace-nowrap overflow-hidden">
                                    <div style={{ position: 'relative', bottom: '4px' }}>{student?.name}</div>
                                </td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                                <td className="border-2 border-black"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>
            <footer className="mt-2 flex justify-between font-bold text-base px-6">
                <div className="text-center">
                    <p>اسم وتوقيع معلم المادة</p>
                    <p className="mt-1 font-normal text-sm">........................................</p>
                </div>
                <div className="text-center">
                    <p>توقيع مدير المدرسة</p>
                    <p className="mt-1 font-normal text-sm">........................................</p>
                </div>
            </footer>
        </div>
    );
}
