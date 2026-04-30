
import React from 'react';
import type { ClassData, SchoolSettings, Student, SubjectGrade } from '../../types.ts';
import { numberToArabicWords } from '../../hooks/lib/numberToWords.ts';

interface PrimaryLogPDFPageProps {
    settings: SchoolSettings;
    classData: ClassData;
    students: Student[];
    examType: 'midYear' | 'finalYear';
    pageNumber: number;
    totalPages: number;
    startingIndex: number;
    isLastPageOfClass?: boolean;
}

const PRIMARY_PASSING_GRADE = 5;
const STUDENTS_PER_PAGE = 20;

// A cell with content that's slightly lifted up to look better.
const LiftedCell: React.FC<{ children: React.ReactNode, className?: string, liftAmount?: string }> = ({ children, className, liftAmount = '6px' }) => (
    <div style={{ position: 'relative', bottom: liftAmount }} className={className}>
        {children}
    </div>
);

export default function PrimaryLogPDFPage({ settings, classData, students, examType, pageNumber, totalPages, startingIndex = 0, isLastPageOfClass = false }: PrimaryLogPDFPageProps) {
    const examTitle = examType === 'midYear' ? 'نصف السنة' : 'نهاية السنة';
    const gradeKey: keyof SubjectGrade = examType === 'midYear' ? 'midYear' : 'finalExam1st';
    
    const subjects = classData.subjects || [];

    // --- Calculate Stats for the ENTIRE class ---
    const allClassStudents = classData.students || [];
    let examinedCount = 0;
    let successCount = 0;
    let supplementaryCount = 0;
    let failCount = 0;

    allClassStudents.forEach(student => {
        const grades = student.grades || {};
        let allGradesEntered = true;
        
        const failingSubjectsCount = subjects.reduce((acc, subject) => {
            const grade = grades[subject.name]?.[gradeKey];
            if (grade === undefined || grade === null) {
                allGradesEntered = false;
            } else if (grade < PRIMARY_PASSING_GRADE) {
                return acc + 1;
            }
            return acc;
        }, 0);

        if (allGradesEntered) {
            examinedCount++;
            if (failingSubjectsCount === 0) {
                successCount++;
            } else if (failingSubjectsCount <= (settings.supplementarySubjectsCount || 3)) {
                supplementaryCount++;
            } else {
                failCount++;
            }
        }
    });

    const totalPassAndSupp = successCount + supplementaryCount;
    const successRate = examinedCount > 0 ? ((totalPassAndSupp / examinedCount) * 100).toFixed(0) : '0';
    // --- End Stats Calculation ---

    const displayRows = [...students];
    // Only pad if it's NOT the last page of this specific class
    if (!isLastPageOfClass) {
        while(displayRows.length < STUDENTS_PER_PAGE) {
            displayRows.push(null as any);
        }
    }

    const headerColors = [
        'bg-red-100', 'bg-orange-100', 'bg-amber-100', 'bg-yellow-100', 
        'bg-lime-100', 'bg-green-100', 'bg-emerald-100', 'bg-teal-100', 
        'bg-cyan-100', 'bg-sky-100', 'bg-blue-100', 'bg-indigo-100', 
        'bg-violet-100', 'bg-purple-100', 'bg-fuchsia-100', 'bg-pink-100', 'bg-rose-100'
    ];
    let colorIndex = 0;
    const nextColor = () => {
        const color = headerColors[colorIndex % headerColors.length];
        colorIndex++;
        return color;
    };
    
    return (
        <div className="w-[794px] h-[1123px] bg-white p-6 flex flex-col font-['Cairo']" dir="rtl">
            <header className="flex justify-between items-center font-bold text-lg mb-4">
                <div className="text-center">
                    <p>إدارة</p>
                    <p>{settings.schoolName}</p>
                </div>
                <div className="text-center">
                    <p>سجل الدرجات للصفوف الأولية</p>
                    <p>إمتحان {examTitle}</p>
                    <p>{settings.academicYear}</p>
                </div>
                 <div className="text-center">
                    <p>الصف والشعبة</p>
                    <p>{classData.stage} / {classData.section}</p>
                </div>
            </header>

            <main className="flex-grow">
                <table className="w-full border-collapse border-2 border-black text-sm table-fixed">
                    <thead className="text-center font-bold text-xs">
                        <tr>
                            <th rowSpan={2} className={`border-2 border-black ${nextColor()}`} style={{width: '30px'}}><LiftedCell>ت</LiftedCell></th>
                            <th rowSpan={2} className={`border-2 border-black ${nextColor()}`} style={{width: '60px'}}><LiftedCell>رقم القبول</LiftedCell></th>
                            <th rowSpan={2} className={`border-2 border-black ${nextColor()}`} style={{width: '150px'}}><LiftedCell>اسم التلميذ</LiftedCell></th>
                            
                            {subjects.map((subject) => (
                                <th key={subject.id} rowSpan={2} className={`border-2 border-black p-0 h-36 align-middle ${nextColor()}`} style={{ width: '30px' }}>
                                    <div className="h-full w-full flex items-center justify-center relative">
                                        <div 
                                            className="transform -rotate-90 absolute"
                                            style={{ width: '130px' }} // This width becomes the height of the text block and allows wrapping
                                        >
                                            <p className="font-bold text-center" style={{ fontSize: '11px', lineHeight: '1.2' }}>
                                                {subject.name}
                                            </p>
                                        </div>
                                    </div>
                                </th>
                            ))}
                            
                            <th colSpan={2} className={`border-2 border-black ${nextColor()}`}><LiftedCell>المجموع</LiftedCell></th>
                            
                            <th rowSpan={2} className={`border-2 border-black ${nextColor()}`} style={{width: '60px'}}><LiftedCell>نتيجة الدور الأول</LiftedCell></th>
                            {examType === 'finalYear' && (
                                <th rowSpan={2} className={`border-2 border-black ${nextColor()}`} style={{width: '60px'}}><LiftedCell>نتيجة الدور الثاني</LiftedCell></th>
                            )}
                        </tr>
                        <tr>
                            <th className={`border-2 border-black ${nextColor()}`} style={{width: '40px'}}><LiftedCell>رقماً</LiftedCell></th>
                            <th className={`border-2 border-black ${nextColor()}`} style={{width: '70px'}}><LiftedCell>كتابةً</LiftedCell></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((student, index) => {
                            const grades = student?.grades || {};
                            const failingSubjects: string[] = [];
                            let allGradesEntered = true;
                            let totalGrade = 0;

                            subjects.forEach(subject => {
                                const grade = grades[subject.name]?.[gradeKey];
                                if (grade === undefined || grade === null) {
                                    allGradesEntered = false;
                                } else {
                                    totalGrade += grade;
                                    if (grade < PRIMARY_PASSING_GRADE) {
                                        failingSubjects.push(subject.name);
                                    }
                                }
                            });

                            let resultText = '';
                            if (student && allGradesEntered) {
                                if (failingSubjects.length === 0) {
                                    resultText = 'ناجح';
                                } else if (failingSubjects.length <= (settings.supplementarySubjectsCount || 3)) {
                                    resultText = 'مكمل';
                                } else {
                                    resultText = 'راسب';
                                }
                            }

                            return (
                                <tr key={student?.id ?? `empty-${index}`} className="h-9">
                                    <td className="border-2 border-black text-center"><LiftedCell>{student ? startingIndex + index + 1 : ''}</LiftedCell></td>
                                    <td className="border-2 border-black text-center"><LiftedCell>{student?.examId || student?.registrationId}</LiftedCell></td>
                                    <td className="border-2 border-black text-right px-2 font-semibold"><LiftedCell>{student?.name}</LiftedCell></td>
                                    {subjects.map(subject => {
                                        const grade = student?.grades?.[subject.name]?.[gradeKey];
                                        const gradeText = (grade !== null && grade !== undefined) ? grade : '';
                                        return (
                                            <td key={subject.id} className={`border-2 border-black text-center font-bold ${grade !== null && grade !== undefined && grade < PRIMARY_PASSING_GRADE ? 'text-red-600' : ''}`}>
                                                <LiftedCell>{gradeText}</LiftedCell>
                                            </td>
                                        )
                                    })}
                                    <td className="border-2 border-black text-center font-bold"><LiftedCell>{student && allGradesEntered ? totalGrade : ''}</LiftedCell></td>
                                    <td className="border-2 border-black text-center font-bold text-xs"><LiftedCell>{student && allGradesEntered ? numberToArabicWords(totalGrade) : ''}</LiftedCell></td>
                                    <td className="border-2 border-black text-center font-bold"><LiftedCell>{resultText}</LiftedCell></td>
                                    {examType === 'finalYear' && (
                                        <td className="border-2 border-black text-center font-bold"></td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </main>
            <footer className="mt-auto pt-4 font-bold text-xs">
                <table className="w-full border-collapse border-2 border-black mb-4">
                    <thead className="bg-yellow-100">
                        <tr>
                            <th className="border-2 border-black p-1"><LiftedCell liftAmount="6px">المشاركون</LiftedCell></th>
                            <th className="border-2 border-black p-1"><LiftedCell liftAmount="6px">الناجحون</LiftedCell></th>
                            <th className="border-2 border-black p-1"><LiftedCell liftAmount="6px">المكملون</LiftedCell></th>
                            <th className="border-2 border-black p-1"><LiftedCell liftAmount="6px">الراسبون</LiftedCell></th>
                            <th className="border-2 border-black p-1"><LiftedCell liftAmount="6px">نسبة النجاح</LiftedCell></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border-2 border-black p-1 text-center">{examinedCount}</td>
                            <td className="border-2 border-black p-1 text-center">{successCount}</td>
                            <td className="border-2 border-black p-1 text-center">{supplementaryCount}</td>
                            <td className="border-2 border-black p-1 text-center">{failCount}</td>
                            <td className="border-2 border-black p-1 text-center">{successRate}%</td>
                        </tr>
                    </tbody>
                </table>
                <div className="flex justify-between items-center">
                    <span>{settings.principalName} / مدير المدرسة</span>
                    <span>{pageNumber} / {totalPages}</span>
                </div>
            </footer>
        </div>
    );
}
