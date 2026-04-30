import React, { useState, useRef } from 'react';
import type { ClassData, Student, User, TeacherAssignment, Subject, TeacherSubjectGrade } from '../types.ts';
// Corrected typo from DEFAULT_SUBJECT_SUBJECTS to DEFAULT_SUBJECTS
import { GRADE_LEVELS, DEFAULT_SUBJECTS } from '../constants.ts';
import { Plus, Upload, Trash2, Edit, Save, X, UserPlus, ListVideo, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../hooks/lib/firebase.ts';


declare const XLSX: any;

const MINISTERIAL_STAGES = ['الثالث متوسط', 'السادس العلمي', 'السادس الادبي'];

interface ClassManagerProps {
    classes: ClassData[];
    onSelectClass: (classId: string) => void;
    currentUser: User;
    users: User[];
    teacherAssignments?: TeacherAssignment[];
}

export default function ClassManager({ classes, onSelectClass, currentUser, users, teacherAssignments }: ClassManagerProps): React.ReactNode {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<Partial<ClassData> | null>(null);
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [selectedClassForStudentAdd, setSelectedClassForStudentAdd] = useState<ClassData | null>(null);
    const [pastedData, setPastedData] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for subject editing
    const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
    const [editingSubjectName, setEditingSubjectName] = useState('');
    const [newSubjectName, setNewSubjectName] = useState('');
    
    const isPrincipal = currentUser.role === 'principal';

    const displayedClasses = React.useMemo(() => {
        let filteredClasses;
        if (isPrincipal) {
            filteredClasses = classes.filter(c => c.principalId === currentUser.id);
        } else { // For teacher
            const assignedClassIds = teacherAssignments?.map(a => a.classId) || [];
            filteredClasses = classes.filter(c => assignedClassIds.includes(c.id));
        }

        // Sort the filtered classes based on stage and section
        return filteredClasses.sort((a, b) => {
            const stageAIndex = GRADE_LEVELS.indexOf(a.stage);
            const stageBIndex = GRADE_LEVELS.indexOf(b.stage);

            if (stageAIndex === -1 && stageBIndex !== -1) return 1;
            if (stageAIndex !== -1 && stageBIndex === -1) return -1;
            
            if (stageAIndex !== stageBIndex) {
                return stageAIndex - stageBIndex;
            }

            return a.section.localeCompare(b.section, 'ar-IQ');
        });
    }, [classes, isPrincipal, currentUser.id, teacherAssignments]);

    const handleOpenModal = (classToEdit: Partial<ClassData> | null) => {
        if (classToEdit) {
            setEditingClass(classToEdit);
        } else {
            const defaultStage = GRADE_LEVELS[6] || GRADE_LEVELS[0];
            setEditingClass({
                id: '',
                stage: defaultStage,
                section: '',
                subjects: [], // Initial state, will be populated on stage change
                students: [],
                principalId: currentUser.id,
            });
        }
        setIsModalOpen(true);
    };

    const handleSaveClass = () => {
        if (!editingClass || !editingClass.stage || !editingClass.section) {
            alert('يرجى تحديد المرحلة والشعبة.');
            return;
        }

        const classToSave: ClassData = {
            id: editingClass.id || uuidv4(),
            stage: editingClass.stage,
            section: editingClass.section,
            subjects: editingClass.subjects || [],
            students: editingClass.students || [],
            principalId: currentUser.id,
            ...MINISTERIAL_STAGES.includes(editingClass.stage) && {
                ministerialDecisionPoints: editingClass.ministerialDecisionPoints ?? 5,
                ministerialSupplementarySubjects: editingClass.ministerialSupplementarySubjects ?? 2,
            }
        };

        db.ref(`classes/${classToSave.id}`).set(classToSave);
        setIsModalOpen(false);
        setEditingClass(null);
    };

    const handleDeleteClass = (classId: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الشعبة وجميع الطلاب فيها؟ لا يمكن التراجع عن هذا الإجراء.')) {
            db.ref(`classes/${classId}`).remove();
        }
    };

    const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStage = e.target.value;
        setEditingClass(prev => ({
            ...prev,
            stage: newStage,
            // You might want to default subjects based on stage here if needed
        }));
    };
    
    const handleSyncAllGrades = async () => {
        const syncType = window.confirm("هل تريد اعتماد ومزامنة درجات (نصف السنة)؟\nموافق: نصف السنة\nإلغاء: نهاية السنة");
        const mode = syncType ? 'midYear' : 'finalYear';
        const modeLabel = syncType ? 'نصف السنة' : 'نهاية السنة';

        if (!window.confirm(`سيتم الآن نقل درجات (${modeLabel}) من السجل العام إلى سجلات كافة المدرسين والطلبة دفعة واحدة. هل أنت متأكد؟`)) {
            return;
        }

        setIsSyncing(true);
        const updates: Record<string, any> = {};
        let syncCount = 0;

        try {
            for (const classData of displayedClasses) {
                const classSubjects = classData.subjects || [];
                const classStudents = classData.students || [];

                for (const subject of classSubjects) {
                    // Find the teacher assigned to this class and subject
                    const assignedTeacher = users.find(u => 
                        u.role === 'teacher' && 
                        u.principalId === currentUser.id &&
                        u.assignments?.some(a => a.classId === classData.id && a.subjectId === subject.id)
                    );

                    if (!assignedTeacher) continue;

                    const submissionGrades: Record<string, TeacherSubjectGrade> = {};

                    classStudents.forEach((student, studentIdx) => {
                        const mainGrades = student.grades?.[subject.name] || {};
                        const currentTeacherGrades = student.teacherGrades?.[subject.name] || {};

                        // Map main grades back to teacher grade structure
                        // FIX: Explicitly handle undefined to avoid Firebase update errors. 
                        // Firebase .update() does not accept 'undefined'.
                        const updatedTeacherGrade: TeacherSubjectGrade = {
                            firstSemMonth1: currentTeacherGrades.firstSemMonth1 ?? null,
                            firstSemMonth2: currentTeacherGrades.firstSemMonth2 ?? null,
                            midYear: mode === 'midYear' ? (mainGrades.midYear ?? null) : (currentTeacherGrades.midYear ?? null),
                            secondSemMonth1: currentTeacherGrades.secondSemMonth1 ?? null,
                            secondSemMonth2: currentTeacherGrades.secondSemMonth2 ?? null,
                            finalExam: mode === 'finalYear' ? (mainGrades.finalExam1st ?? null) : (currentTeacherGrades.finalExam ?? null),
                            october: currentTeacherGrades.october ?? null,
                            november: currentTeacherGrades.november ?? null,
                            december: currentTeacherGrades.december ?? null,
                            january: currentTeacherGrades.january ?? null,
                            february: currentTeacherGrades.february ?? null,
                            march: currentTeacherGrades.march ?? null,
                            april: currentTeacherGrades.april ?? null,
                        };

                        // 1. Update Student record in the class
                        updates[`classes/${classData.id}/students/${studentIdx}/teacherGrades/${subject.name}`] = updatedTeacherGrade;
                        submissionGrades[student.id] = updatedTeacherGrade;
                        syncCount++;
                    });

                    // 2. Create/Update a "fake" submission record to show in "Received Logs"
                    const submissionId = `sync_${assignedTeacher.id}_${classData.id}_${subject.id}_${mode}`;
                    updates[`teacher_submissions/${submissionId}`] = {
                        id: submissionId,
                        teacherId: assignedTeacher.id,
                        classId: classData.id,
                        subjectId: subject.id,
                        submittedAt: new Date().toISOString(),
                        grades: submissionGrades,
                        isSystemSynced: true // Flag to distinguish
                    };
                }
            }

            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
                alert(`تمت عملية المزامنة بنجاح! تم تحديث ${syncCount} حقل درجات.`);
            } else {
                alert("لم يتم العثور على بيانات لمزامنتها.");
            }
        } catch (error) {
            console.error("Sync error:", error);
            alert("حدث خطأ أثناء المزامنة. يرجى التحقق من الاتصال.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAddStudentFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedClassForStudentAdd) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (typeof XLSX === 'undefined') {
                alert('مكتبة معالجة ملفات Excel غير متاحة. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.');
                setIsStudentModalOpen(false);
                return;
            }

            try {
                if (!event.target?.result) throw new Error("فشل قراءة الملف.");
                const data = new Uint8Array(event.target.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (json.length <= 1) throw new Error("الملف فارغ أو لا يحتوي على بيانات طلاب.");

                const newStudents: Student[] = json
                    .slice(1)
                    .map((row: any[]) => ({
                        id: uuidv4(),
                        name: row[0] ? String(row[0]).trim() : '',
                        examId: row[1] ? String(row[1]).trim() : '',
                        registrationId: row[2] ? String(row[2]).trim() : '',
                        birthDate: row[3] ? String(row[3]).trim() : '',
                        grades: {},
                    }))
                    .filter(student => student.name);

                if (newStudents.length > 0) {
                    const updatedStudents = [...(selectedClassForStudentAdd.students || []), ...newStudents];
                    db.ref(`classes/${selectedClassForStudentAdd.id}/students`).set(updatedStudents);
                    alert(`تمت إضافة ${newStudents.length} طالب بنجاح.`);
                    setIsStudentModalOpen(false);
                } else {
                    throw new Error("لم يتم العثور على أسماء طلاب صالحة في الملف.");
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                alert(`حدث خطأ أثناء معالجة الملف: ${errorMessage}`);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleAddStudentFromPaste = () => {
        if (!pastedData || !selectedClassForStudentAdd) return;
        try {
            const rows = pastedData.split('\n').filter(row => row.trim() !== '');
            const newStudents: Student[] = rows.map(row => {
                const columns = row.split('\t');
                return {
                    id: uuidv4(),
                    name: columns[0] ? columns[0].trim() : '',
                    examId: columns[1] ? columns[1].trim() : '',
                    registrationId: columns[2] ? columns[2].trim() : '',
                    birthDate: columns[3] ? columns[3].trim() : '',
                    grades: {},
                };
            }).filter(student => student.name);

            if (newStudents.length > 0) {
                const updatedStudents = [...(selectedClassForStudentAdd.students || []), ...newStudents];
                db.ref(`classes/${selectedClassForStudentAdd.id}/students`).set(updatedStudents);
                alert(`تمت إضافة ${newStudents.length} طالب بنجاح.`);
                setIsStudentModalOpen(false);
                setPastedData('');
            } else {
                alert("لم يتم العثور على بيانات طلاب صالحة.");
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`حدث خطأ أثناء معالجة البيانات: ${errorMessage}`);
        }
    };
    
    const handleSubjectNameChange = () => {
        if (!editingClass || !editingSubjectId || !editingSubjectName.trim()) return;
        const newSubjects = (editingClass.subjects || []).map(s => 
            s.id === editingSubjectId ? { ...s, name: editingSubjectName.trim() } : s
        );
        setEditingClass(prev => ({...prev, subjects: newSubjects}));
        setEditingSubjectId(null);
        setEditingSubjectName('');
    };

    const handleAddSubject = () => {
        if (!editingClass || !newSubjectName.trim()) return;
        const newSubject: Subject = { id: uuidv4(), name: newSubjectName.trim() };
        const newSubjects = [...(editingClass.subjects || []), newSubject];
        setEditingClass(prev => ({...prev, subjects: newSubjects}));
        setNewSubjectName('');
    };
    
    const handleDeleteSubject = (subjectIdToDelete: string) => {
         if (!editingClass) return;
         const newSubjects = (editingClass.subjects || []).filter(s => s.id !== subjectIdToDelete);
         setEditingClass(prev => ({...prev, subjects: newSubjects}));
    };
    
    const renderModal = () => {
        if (!isModalOpen) return null;
        const isMinisterial = editingClass?.stage ? MINISTERIAL_STAGES.includes(editingClass.stage) : false;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
                    <h3 className="text-xl font-bold mb-4">{editingClass?.id ? 'تعديل الشعبة' : 'إضافة شعبة جديدة'}</h3>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700">المرحلة الدراسية</label>
                                <select
                                    value={editingClass?.stage || ''}
                                    onChange={handleStageChange}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm bg-white disabled:bg-gray-200"
                                    disabled={!!editingClass?.id}
                                >
                                    {GRADE_LEVELS.map(level => (
                                        <option key={level} value={level}>{level}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">اسم الشعبة</label>
                                <input
                                    type="text"
                                    value={editingClass?.section || ''}
                                    onChange={(e) => setEditingClass(prev => ({ ...prev, section: e.target.value }))}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                />
                            </div>
                        </div>

                        {isMinisterial && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                 <div>
                                    <label className="block text-sm font-medium text-gray-700">درجات القرار الوزاري</label>
                                    <input
                                        type="number"
                                        value={editingClass?.ministerialDecisionPoints ?? 5}
                                        onChange={(e) => setEditingClass(prev => ({ ...prev, ministerialDecisionPoints: parseInt(e.target.value) }))}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">عدد مواد الاكمال الوزاري</label>
                                    <input
                                        type="number"
                                        value={editingClass?.ministerialSupplementarySubjects ?? 2}
                                        onChange={(e) => setEditingClass(prev => ({ ...prev, ministerialSupplementarySubjects: parseInt(e.target.value) }))}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-4">
                            <h4 className="font-semibold mb-2">المواد الدراسية</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto border p-2 rounded-md">
                                {(editingClass?.subjects || []).map(subject => (
                                    <div key={subject.id} className="flex items-center gap-2 p-1 bg-gray-100 rounded">
                                        {editingSubjectId === subject.id ? (
                                            <>
                                                <input value={editingSubjectName} onChange={e => setEditingSubjectName(e.target.value)} className="flex-grow p-1 border rounded" autoFocus onBlur={handleSubjectNameChange} onKeyDown={e => e.key === 'Enter' && handleSubjectNameChange()}/>
                                                <button onClick={handleSubjectNameChange}><Save size={18} className="text-green-600"/></button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="flex-grow">{subject.name}</span>
                                                <button onClick={() => { setEditingSubjectId(subject.id); setEditingSubjectName(subject.name); }}><Edit size={18} className="text-yellow-600"/></button>
                                                <button onClick={() => handleDeleteSubject(subject.id)}><Trash2 size={18} className="text-red-600"/></button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                             <div className="flex items-center gap-2 mt-2">
                                <input value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSubject()} placeholder="إضافة مادة جديدة" className="flex-grow p-2 border rounded"/>
                                <button onClick={handleAddSubject} className="p-2 bg-blue-500 text-white rounded"><Plus/></button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md flex items-center gap-2"><X size={18} /> إلغاء</button>
                        <button onClick={handleSaveClass} className="px-4 py-2 bg-green-600 text-white rounded-md flex items-center gap-2"><Save size={18} /> حفظ</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderStudentModal = () => {
        if (!isStudentModalOpen) return null;
        return (
             <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                    <h3 className="text-xl font-bold mb-4">إضافة طلاب إلى {selectedClassForStudentAdd?.stage} / {selectedClassForStudentAdd?.section}</h3>
                    <div className="space-y-4">
                         <div className="p-4 border rounded-lg">
                             <h4 className="font-semibold mb-2">1. إضافة من ملف Excel</h4>
                             <p className="text-sm text-gray-500 mb-2">يجب أن يحتوي الملف على الأعمدة التالية بالترتيب: الاسم، الرقم الامتحاني، رقم القيد، التولد.</p>
                             <input type="file" ref={fileInputRef} onChange={handleAddStudentFromFile} accept=".xlsx, .xls" className="hidden" />
                             <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                                 <Upload size={18} />
                                 <span>اختر ملف</span>
                             </button>
                         </div>
                         <div className="p-4 border rounded-lg">
                             <h4 className="font-semibold mb-2">2. لصق البيانات من جدول</h4>
                             <p className="text-sm text-gray-500 mb-2">انسخ البيانات من Excel والصقها هنا. تأكد من نفس ترتيب الأعمدة المذكور أعلاه.</p>
                             <textarea value={pastedData} onChange={(e) => setPastedData(e.target.value)} rows={5} className="w-full p-2 border rounded" placeholder="الصق بيانات الطلاب هنا..."></textarea>
                             <button onClick={handleAddStudentFromPaste} className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                 إضافة من النص
                             </button>
                         </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button onClick={() => setIsStudentModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">إغلاق</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-0">
            {isPrincipal && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">إدارة الشعب الدراسية</h2>
                    <div className="flex flex-wrap gap-2">
                        <button 
                            onClick={handleSyncAllGrades}
                            disabled={isSyncing || classes.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-all shadow-md disabled:bg-gray-400"
                            title="اعتماد درجات السجل العام وإرسالها لسجلات المدرسين والطلبة"
                        >
                            {isSyncing ? <Loader2 className="animate-spin" size={20}/> : <RefreshCw size={20} />}
                            <span>{isSyncing ? 'جاري الاعتماد...' : 'اعتماد ومزامنة كافة الدرجات'}</span>
                        </button>
                        <button onClick={() => handleOpenModal(null)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-colors shadow-md">
                            <Plus size={20} />
                            <span>إضافة شعبة جديدة</span>
                        </button>
                    </div>
                </div>
            )}
            
            <div className="space-y-4">
                {displayedClasses.map(cls => (
                    <div key={cls.id} className="bg-white p-4 rounded-lg shadow-md border-r-4 border-cyan-500">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{cls.stage} - {cls.section}</h3>
                                <p className="text-sm text-gray-500">{(cls.students || []).length} طالب</p>
                            </div>
                            <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-shrink-0">
                                {isPrincipal && (
                                    <>
                                        <button onClick={() => { setSelectedClassForStudentAdd(cls); setIsStudentModalOpen(true); }} className="p-2 text-white bg-green-500 rounded-md hover:bg-green-600 transition" title="إضافة طلاب"><UserPlus size={18}/></button>
                                        <button onClick={() => handleOpenModal(cls)} className="p-2 text-white bg-yellow-500 rounded-md hover:bg-yellow-600 transition" title="تعديل"><Edit size={18}/></button>
                                        <button onClick={() => handleDeleteClass(cls.id)} className="p-2 text-white bg-red-500 rounded-md hover:bg-red-600 transition" title="حذف"><Trash2 size={18}/></button>
                                    </>
                                )}
                                <button onClick={() => onSelectClass(cls.id)} className="p-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 transition" title="عرض سجل الدرجات"><ListVideo size={18}/></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {renderModal()}
            {renderStudentModal()}
        </div>
    );
}