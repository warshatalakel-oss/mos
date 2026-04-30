
import React, { useState, useMemo, useEffect } from 'react';
import type { User, ClassData, TeacherSubmission, TeacherSubjectGrade, SchoolSettings, Student, Teacher } from '../../types.ts';
import TeacherGradeSheet from '../teacher/TeacherGradeSheet.tsx';
import { db } from '../../hooks/lib/firebase.ts';
import { Eye, ArrowLeft, CheckCircle, Lock, Unlock, Loader2, CheckCheck } from 'lucide-react';

interface ReceiveTeacherLogProps {
    principal: User;
    classes: ClassData[];
    settings: SchoolSettings;
    users: User[];
}

const DEFAULT_TEACHER_GRADE: TeacherSubjectGrade = {
    firstSemMonth1: null,
    firstSemMonth2: null,
    midYear: null,
    secondSemMonth1: null,
    secondSemMonth2: null,
    finalExam: null,
    october: null,
    november: null,
    december: null,
    january: null,
    february: null,
    march: null,
    april: null,
};


export default function ReceiveTeacherLog({ principal, classes, settings, users }: ReceiveTeacherLogProps) {
    const [submissions, setSubmissions] = useState<TeacherSubmission[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
    const [selectedSubmission, setSelectedSubmission] = useState<TeacherSubmission | null>(null);
    const [isApproving, setIsApproving] = useState<string | null>(null); // 'sem1' | 'sem2' | 'all_sem1' | 'all_sem2' | null

    useEffect(() => {
        const submissionsRef = db.ref('teacher_submissions');
        const callback = (snapshot: any) => {
            const data = snapshot.val();
            const allSubmissions: TeacherSubmission[] = data ? Object.values(data) : [];
            const principalTeacherIds = new Set(users.filter(u => u.principalId === principal.id).map(u => u.id));
            const relevantSubmissions = allSubmissions.filter(sub => principalTeacherIds.has(sub.teacherId));
            setSubmissions(relevantSubmissions);
        };
        submissionsRef.on('value', callback);
        return () => submissionsRef.off('value', callback);
    }, [principal.id, users]);

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher' && u.principalId === principal.id), [users, principal.id]);
    
    const latestSubmissions = useMemo(() => {
        const latest = new Map<string, TeacherSubmission>();
        (submissions || []).forEach(sub => {
            const key = `${sub.teacherId}-${sub.classId}-${sub.subjectId}`;
            const existing = latest.get(key);
            if (!existing || new Date(sub.submittedAt) > new Date(existing.submittedAt)) {
                latest.set(key, sub);
            }
        });
        return Array.from(latest.values()).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }, [submissions]);

    const filteredSubmissions = useMemo(() => {
        if (!selectedTeacherId) {
            return latestSubmissions;
        }
        return latestSubmissions.filter(sub => sub.teacherId === selectedTeacherId);
    }, [selectedTeacherId, latestSubmissions]);


    const handleViewSubmission = (submission: TeacherSubmission) => {
        setSelectedSubmission(submission);
    };
    
    const getTeacherName = (teacherId: string) => users.find(u => u.id === teacherId)?.name || 'مدرس غير معروف';
    const getClassName = (classId: string) => {
        const cls = classes.find(c => c.id === classId);
        return cls ? `${cls.stage} - ${cls.section}` : 'شعبة محذوفة';
    }
    const getSubjectName = (classId: string, subjectId: string) => {
        const cls = classes.find(c => c.id === classId);
        const sub = (cls?.subjects || []).find(s => s.id === subjectId);
        return sub ? sub.name : 'مادة محذوفة';
    }

    const hasValue = (val: any) => val !== null && val !== undefined;

    const handleApproveGrading = async (mode: 'sem1' | 'sem2') => {
        if (!selectedSubmission) return;
        
        const confirmMsg = mode === 'sem1' 
            ? "هل أنت متأكد من اعتماد درجات الفصل الأول ونصف السنة لهذا السجل؟ سيتم نقلها إلى سجل الشعبة الرئيسي."
            : "هل أنت متأكد من اعتماد درجات الفصل الثاني والسعي السنوي لهذا السجل؟ سيتم نقلها إلى سجل الشعبة الرئيسي.";
            
        if (!window.confirm(confirmMsg)) return;

        setIsApproving(mode);
        const targetClass = classes.find(c => c.id === selectedSubmission.classId);
        const subjectName = getSubjectName(selectedSubmission.classId, selectedSubmission.subjectId);
        
        if (!targetClass || !targetClass.students) {
            alert("خطأ: لم يتم العثور على الشعبة المطلوبة أو قائمة الطلاب.");
            setIsApproving(null);
            return;
        }

        const updates: Record<string, any> = {};
        let count = 0;

        Object.entries(selectedSubmission.grades || {}).forEach(([studentId, grades]) => {
            const sGrades = grades as TeacherSubjectGrade;
            const studentIndex = targetClass.students.findIndex(s => s.id === studentId);
            if (studentIndex === -1) return;

            const basePath = `classes/${targetClass.id}/students/${studentIndex}/grades/${subjectName}`;
            
            if (mode === 'sem1') {
                if (hasValue(sGrades.firstSemMonth1) && hasValue(sGrades.firstSemMonth2)) {
                    updates[`${basePath}/firstTerm`] = Math.round((Number(sGrades.firstSemMonth1) + Number(sGrades.firstSemMonth2)) / 2);
                    count++;
                }
                if (hasValue(sGrades.midYear)) {
                    updates[`${basePath}/midYear`] = sGrades.midYear;
                    count++;
                }
            } else {
                if (hasValue(sGrades.secondSemMonth1) && hasValue(sGrades.secondSemMonth2)) {
                    updates[`${basePath}/secondTerm`] = Math.round((Number(sGrades.secondSemMonth1) + Number(sGrades.secondSemMonth2)) / 2);
                    count++;
                }
            }
        });

        if (count === 0) {
            alert("لم يتم العثور على درجات مكتملة لنقلها.");
            setIsApproving(null);
            return;
        }

        try {
            await db.ref().update(updates);
            // Critical fix: Clear selection first to prevent DOM conflicts during re-render
            setSelectedSubmission(null);
            setIsApproving(null);
            setTimeout(() => {
                alert("تم اعتماد ونقل الدرجات بنجاح.");
            }, 100);
        } catch (error) {
            console.error("Failed to approve grades:", error);
            alert("حدث خطأ أثناء اعتماد الدرجات. تأكد من استقرار الإنترنت.");
            setIsApproving(null);
        }
    };

    const handleApproveAll = async (mode: 'sem1' | 'sem2') => {
        const targets = latestSubmissions;
        if (targets.length === 0) {
            alert("لا توجد سجلات مستلمة للاعتماد.");
            return;
        }

        const confirmMsg = mode === 'sem1'
            ? `هل أنت متأكد من اعتماد درجات الفصل الأول ونصف السنة لجميع السجلات المستلمة (${targets.length} سجل)؟`
            : `هل أنت متأكد من اعتماد درجات الفصل الثاني لجميع السجلات المستلمة (${targets.length} سجل)؟`;

        if (!window.confirm(confirmMsg)) return;

        setIsApproving(mode === 'sem1' ? 'all_sem1' : 'all_sem2');
        const updates: Record<string, any> = {};
        let totalCount = 0;

        for (const sub of targets) {
            const targetClass = classes.find(c => c.id === sub.classId);
            const subjectName = getSubjectName(sub.classId, sub.subjectId);
            if (!targetClass || !targetClass.students || !sub.grades) continue;

            Object.entries(sub.grades).forEach(([studentId, grades]) => {
                const sGrades = grades as TeacherSubjectGrade;
                const studentIndex = targetClass.students.findIndex(s => s.id === studentId);
                if (studentIndex === -1) return;

                const basePath = `classes/${targetClass.id}/students/${studentIndex}/grades/${subjectName}`;

                if (mode === 'sem1') {
                    if (hasValue(sGrades.firstSemMonth1) && hasValue(sGrades.firstSemMonth2)) {
                        updates[`${basePath}/firstTerm`] = Math.round((Number(sGrades.firstSemMonth1) + Number(sGrades.firstSemMonth2)) / 2);
                        totalCount++;
                    }
                    if (hasValue(sGrades.midYear)) {
                        updates[`${basePath}/midYear`] = sGrades.midYear;
                        totalCount++;
                    }
                } else {
                    if (hasValue(sGrades.secondSemMonth1) && hasValue(sGrades.secondSemMonth2)) {
                        updates[`${basePath}/secondTerm`] = Math.round((Number(sGrades.secondSemMonth1) + Number(sGrades.secondSemMonth2)) / 2);
                        totalCount++;
                    }
                }
            });
        }

        if (totalCount === 0) {
            alert("لم يتم العثور على درجات جديدة لنقلها.");
            setIsApproving(null);
            return;
        }

        try {
            await db.ref().update(updates);
            setIsApproving(null);
            setTimeout(() => {
                alert(`تم اعتماد كافة السجلات بنجاح. إجمالي الحقول المحدثة: ${totalCount}`);
            }, 100);
        } catch (error) {
            console.error("Failed to approve all grades:", error);
            alert("حدث خطأ أثناء الاعتماد الجماعي.");
            setIsApproving(null);
        }
    };

    const toggleLockGrading = async (semester: 1 | 2) => {
        const field = semester === 1 ? 'lockSem1Grading' : 'lockSem2Grading';
        const currentValue = settings[field as keyof SchoolSettings] || false;
        const confirmMsg = currentValue 
            ? `هل أنت متأكد من فتح صلاحية تعديل درجات الفصل ${semester === 1 ? 'الأول' : 'الثاني'} للمدرسين؟`
            : `هل أنت متأكد من قفل صلاحية تعديل درجات الفصل ${semester === 1 ? 'الأول' : 'الثاني'} للمدرسين؟ سيتم منعهم من تغيير الدرجات أو إرسال السجلات.`;

        if (!window.confirm(confirmMsg)) return;

        try {
            await db.ref(`settings/${principal.id}/${field}`).set(!currentValue);
        } catch (error) {
            console.error("Failed to toggle lock:", error);
            alert("حدث خطأ أثناء تحديث الإعدادات.");
        }
    };

    if (selectedSubmission) {
        const classData = classes.find(c => c.id === selectedSubmission.classId);
        const teacher = users.find(u => u.id === selectedSubmission.teacherId);

        if (!classData || !teacher) {
            return (
                <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                    <p className="text-red-500">خطأ: لم يتم العثور على بيانات الصف أو المدرس لهذا السجل.</p>
                    <button onClick={() => setSelectedSubmission(null)} className="mt-4 px-4 py-2 bg-gray-300 rounded-lg flex items-center gap-2 mx-auto">
                        <ArrowLeft />
                        العودة
                    </button>
                </div>
            );
        }
        
        const subjectName = getSubjectName(classData.id, selectedSubmission.subjectId);
        const classDataWithGrades: ClassData = {
            ...classData,
            students: (classData.students || []).map((s: Student) => {
                const submittedGrades = (selectedSubmission.grades || {})[s.id] || {};
                return {
                    ...s,
                    teacherGrades: {
                        ...s.teacherGrades,
                        [subjectName]: { ...DEFAULT_TEACHER_GRADE, ...submittedGrades },
                    }
                };
            })
        };
        
        return (
            <div className="space-y-4">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-md no-print">
                    <button onClick={() => setSelectedSubmission(null)} className="px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 flex items-center gap-2">
                        <ArrowLeft />
                        العودة للقائمة
                    </button>
                    
                    <div className="flex flex-wrap gap-2">
                        <button 
                            onClick={() => handleApproveGrading('sem1')}
                            disabled={!!isApproving}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                        >
                            {isApproving === 'sem1' ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                            اعتماد الفصل الأول ونصف السنة
                        </button>
                        <button 
                            onClick={() => handleApproveGrading('sem2')}
                            disabled={!!isApproving}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 disabled:bg-gray-400"
                        >
                            {isApproving === 'sem2' ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                            اعتماد الفصل الثاني والسعي السنوي
                        </button>
                    </div>
                 </div>

                <TeacherGradeSheet
                    classData={classDataWithGrades}
                    teacher={teacher as Teacher}
                    settings={settings}
                    isReadOnly={true}
                    subjectId={selectedSubmission.subjectId}
                />
            </div>
        )
    }

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800">استلام سجلات المدرسين</h2>
                    <div className="flex flex-wrap gap-4 mt-3">
                        <button 
                            onClick={() => toggleLockGrading(1)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${settings.lockSem1Grading ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-green-100 text-green-700 border border-green-300'}`}
                        >
                            {settings.lockSem1Grading ? <Lock size={16}/> : <Unlock size={16}/>}
                            {settings.lockSem1Grading ? 'الفصل الأول مقفل' : 'قفل الفصل الأول'}
                        </button>
                        <button 
                            onClick={() => toggleLockGrading(2)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${settings.lockSem2Grading ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-green-100 text-green-700 border border-green-300'}`}
                        >
                            {settings.lockSem2Grading ? <Lock size={16}/> : <Unlock size={16}/>}
                            {settings.lockSem2Grading ? 'الفصل الثاني مقفل' : 'قفل الفصل الثاني'}
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => handleApproveAll('sem1')}
                        disabled={!!isApproving || latestSubmissions.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white font-bold rounded-lg hover:bg-green-800 disabled:bg-gray-300 shadow-sm"
                    >
                        {isApproving === 'all_sem1' ? <Loader2 className="animate-spin" size={18}/> : <CheckCheck size={18}/>}
                        اعتماد كافة سجلات ف1
                    </button>
                    <button 
                        onClick={() => handleApproveAll('sem2')}
                        disabled={!!isApproving || latestSubmissions.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-700 text-white font-bold rounded-lg hover:bg-cyan-800 disabled:bg-gray-300 shadow-sm"
                    >
                        {isApproving === 'all_sem2' ? <Loader2 className="animate-spin" size={18}/> : <CheckCheck size={18}/>}
                        اعتماد كافة سجلات ف2
                    </button>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                     <label htmlFor="teacher-filter" className="font-semibold text-gray-700 whitespace-nowrap">تصفية:</label>
                    <select 
                        id="teacher-filter"
                        onChange={e => setSelectedTeacherId(e.target.value)} 
                        value={selectedTeacherId}
                        className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg bg-white"
                    >
                        <option value="">-- كل المدرسين --</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            </header>

            <div className="space-y-4">
                {filteredSubmissions.length > 0 ? (
                    filteredSubmissions.map(sub => (
                         <div key={sub.id} className="p-4 bg-gray-50 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md transition-shadow">
                            <div>
                                <p className="font-bold text-lg text-gray-800">{getTeacherName(sub.teacherId)}</p>
                                <div className="text-sm text-gray-600 mt-1">
                                    <span className="font-semibold text-cyan-700">{getClassName(sub.classId)}</span>
                                    <span className="mx-2 text-gray-300">|</span>
                                    <span className="font-semibold">{getSubjectName(sub.classId, sub.subjectId)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 mt-2 sm:mt-0 sm:ml-4 flex-shrink-0">
                                 <span className="text-xs text-gray-500">
                                    تحديث: {new Date(sub.submittedAt).toLocaleString('ar-EG')}
                                </span>
                                <button onClick={() => handleViewSubmission(sub)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600">
                                    <Eye size={16} />
                                    عرض واعتماد
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center p-12 bg-gray-100 rounded-lg border-2 border-dashed">
                         <p className="text-xl text-gray-500">لم يتم استلام أي سجلات من المدرسين بعد.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

