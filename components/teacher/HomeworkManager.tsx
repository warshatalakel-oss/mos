import React, { useState, useMemo } from 'react';
import type { Teacher, ClassData, Homework } from '../../types.ts';
import { db } from '../../hooks/lib/firebase.ts';
import { v4 as uuidv4 } from 'uuid';
import { Send, ClipboardList, Loader2 } from 'lucide-react';
import HomeworkReview from './HomeworkReview.tsx';

interface HomeworkManagerProps {
    teacher: Teacher;
    classes: ClassData[];
}

export default function HomeworkManager({ teacher, classes }: HomeworkManagerProps) {
    const [activeTab, setActiveTab] = useState<'send' | 'review'>('send');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [deadline, setDeadline] = useState('');
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

    const teacherAssignments = useMemo(() => {
        const uniqueSubjects = new Map<string, { subjectId: string, subjectName: string, classIds: string[] }>();
        (teacher.assignments || []).forEach(a => {
            const classInfo = classes.find(c => c.id === a.classId);
            const subjectInfo = classInfo?.subjects.find(s => s.id === a.subjectId);
            if (subjectInfo) {
                if (uniqueSubjects.has(subjectInfo.id)) {
                    uniqueSubjects.get(subjectInfo.id)!.classIds.push(a.classId);
                } else {
                    uniqueSubjects.set(subjectInfo.id, { subjectId: subjectInfo.id, subjectName: subjectInfo.name, classIds: [a.classId] });
                }
            }
        });
        return Array.from(uniqueSubjects.values());
    }, [teacher.assignments, classes]);

    const classesForSubject = useMemo(() => {
        if (!selectedSubjectId) return [];
        const assignment = teacherAssignments.find(a => a.subjectId === selectedSubjectId);
        return assignment ? assignment.classIds : [];
    }, [selectedSubjectId, teacherAssignments]);

    const handleSendHomework = async () => {
        if (!title.trim() || !deadline || selectedClassIds.length === 0 || !selectedSubjectId) {
            alert('يرجى اختيار مادة، وملء العنوان، والموعد النهائي، واختيار شعبة واحدة على الأقل.');
            return;
        }
        
        const assignment = teacherAssignments.find(a => a.subjectId === selectedSubjectId);
        if (!assignment) {
            alert('لا يمكنك إرسال واجب بدون تعيين مادة لك.');
            return;
        }

        setIsSending(true);

        try {
            const homeworkId = uuidv4();
            const newHomework: Omit<Homework, 'attachments' | 'texts'> = {
                id: homeworkId,
                principalId: teacher.principalId!,
                teacherId: teacher.id,
                classIds: selectedClassIds,
                subjectId: assignment.subjectId,
                subjectName: assignment.subjectName,
                title: title.trim(),
                notes: notes.trim(),
                deadline,
                createdAt: new Date().toISOString(),
            };
            
            const updates: Record<string, any> = {};
            updates[`/homework_data/${teacher.principalId}/${homeworkId}`] = newHomework;
            selectedClassIds.forEach(classId => {
                updates[`/active_homework/${teacher.principalId}/${classId}/${assignment.subjectId}`] = { homeworkId };
            });

            await db.ref().update(updates);
            alert('تم إرسال الواجب بنجاح.');
            setTitle(''); setNotes(''); setDeadline(''); setSelectedClassIds([]);

        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء إرسال الواجب.');
        } finally {
            setIsSending(false);
        }
    };

    const renderSendTab = () => (
        <div className="space-y-6 max-w-2xl mx-auto">
            <select value={selectedSubjectId} onChange={e => { setSelectedSubjectId(e.target.value); setSelectedClassIds([]); }} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500">
                <option value="">-- اختر المادة --</option>
                {teacherAssignments.map(a => <option key={a.subjectId} value={a.subjectId}>{a.subjectName}</option>)}
            </select>
            {selectedSubjectId && (
                <>
                    <input type="text" placeholder="عنوان الواجب" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"/>
                    <textarea placeholder="ملاحظات أو نص الواجب (اختياري)" value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"/>
                    <div>
                        <label className="block text-md font-medium text-gray-700 mb-1">الموعد النهائي للتسليم</label>
                        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"/>
                    </div>
                    <div>
                        <label className="block text-md font-medium text-gray-700 mb-2">إرسال إلى الشعب:</label>
                        <div className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                            {classesForSubject.map(classId => {
                                const classInfo = classes.find(c => c.id === classId);
                                if (!classInfo) return null;
                                return (
                                    <label key={classId} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                                        <input type="checkbox" checked={selectedClassIds.includes(classId)} onChange={e => {
                                            if (e.target.checked) setSelectedClassIds(p => [...p, classId]);
                                            else setSelectedClassIds(p => p.filter(id => id !== classId));
                                        }} className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"/>
                                        <span className="font-semibold">{classInfo.stage} - {classInfo.section}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                    <button onClick={handleSendHomework} disabled={isSending} className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-cyan-600 text-white font-extrabold text-lg rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 shadow-lg">
                        {isSending ? <Loader2 className="animate-spin"/> : <Send/>} {isSending ? 'جاري الإرسال...' : 'إرسال الواجب'}
                    </button>
                </>
            )}
        </div>
    );

    const renderReviewTab = () => {
        return <HomeworkReview teacher={teacher} classes={classes} />;
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex border-b mb-6">
                <button onClick={() => setActiveTab('send')} className={`px-6 py-3 font-semibold flex items-center gap-2 text-lg ${activeTab === 'send' ? 'border-b-2 border-cyan-500 text-cyan-600' : 'text-gray-500'}`}><Send/> إرسال واجب</button>
                <button onClick={() => setActiveTab('review')} className={`px-6 py-3 font-semibold flex items-center gap-2 text-lg ${activeTab === 'review' ? 'border-b-2 border-cyan-500 text-cyan-600' : 'text-gray-500'}`}><ClipboardList/> متابعة التسليمات</button>
            </div>
            {activeTab === 'send' ? renderSendTab() : renderReviewTab()}
        </div>
    );
}