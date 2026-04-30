import React, { useState, useEffect, useCallback } from 'react';
import type { SchoolSettings, User } from '../types.ts';
import { SCHOOL_TYPES, SCHOOL_GENDERS, SCHOOL_LEVELS, GOVERNORATES } from '../constants.ts';
import { Users, Database, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { db } from '../hooks/lib/firebase.ts';

interface SettingsProps {
    currentSettings: SchoolSettings;
    onSave: (settings: SchoolSettings) => void;
    currentUser: User;
    updateUser: (userId: string, updater: (user: User) => User) => void;
}

export default function Settings({ currentSettings, onSave, currentUser, updateUser }: SettingsProps): React.ReactNode {
    const [settings, setSettings] = useState<SchoolSettings>(currentSettings);
    const [onlineUsersCount, setOnlineUsersCount] = useState<number | null>(null);
    const [dbSize, setDbSize] = useState<string | null>(null);
    const [isCalculatingSize, setIsCalculatingSize] = useState(false);
    
    const isPrincipal = currentUser.role === 'principal';
    const isFormDisabled = currentUser.role === 'teacher';
    const areNameFieldsDisabled = currentUser.role === 'principal' || currentUser.role === 'teacher';

    // Effect for online users count
    useEffect(() => {
        if (!isPrincipal) return;

        const statusRef = db.ref('status');
        const onStatusChange = (snapshot: any) => {
            setOnlineUsersCount(snapshot.numChildren());
        };

        statusRef.on('value', onStatusChange);

        return () => {
            statusRef.off('value', onStatusChange);
        };
    }, [isPrincipal]);

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['بايت', 'كيلوبايت', 'ميكابايت', 'جيكابايت'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const getEstimatedDbSize = useCallback(async () => {
        if (!isPrincipal) return;

        setIsCalculatingSize(true);
        setDbSize(null);

        const nodesToMeasure = [
            'classes', 'users', 'settings', 'teacher_submissions',
            'student_submissions', 'evaluations', 'absences', 'behavior_deductions',
            'homework_data', 'homework_submissions', 'schedules', 'xo_games'
        ];
        let totalBytes = 0;

        try {
            const snapshots = await Promise.all(
                nodesToMeasure.map(node => db.ref(node).get())
            );

            snapshots.forEach(snapshot => {
                if (snapshot.exists()) {
                    totalBytes += JSON.stringify(snapshot.val()).length;
                }
            });

            setDbSize(formatBytes(totalBytes));
        } catch (error) {
            console.error("Error calculating DB size:", error);
            setDbSize('فشل الحساب');
        } finally {
            setIsCalculatingSize(false);
        }
    }, [isPrincipal]);

    useEffect(() => {
        getEstimatedDbSize();
    }, [getEstimatedDbSize]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumberInput = e.target instanceof HTMLInputElement && e.target.type === 'number';
        setSettings(prev => ({
            ...prev,
            [name]: isNumberInput ? (parseInt(value, 10) || 0) : value,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(settings);
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">الإعدادات العامة</h2>
            
            {isPrincipal && (
                <div className="mb-8 p-4 bg-gray-100 rounded-lg border">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">إحصائيات النظام</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Online Users Card */}
                        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
                            <div className="bg-green-100 text-green-600 p-3 rounded-full">
                                <Users size={28} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">المستخدمون المتصلون حالياً</p>
                                <p className="text-3xl font-bold">
                                    {onlineUsersCount === null ? <Loader2 className="animate-spin" /> : onlineUsersCount}
                                </p>
                            </div>
                        </div>
                        {/* Database Size Card */}
                        <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
                                    <Database size={28} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">حجم البيانات المخزنة (تقريبي)</p>
                                    <p className="text-3xl font-bold">
                                        {isCalculatingSize ? <Loader2 className="animate-spin" /> : dbSize}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 text-xs text-gray-500 mt-2">
                                <button onClick={getEstimatedDbSize} disabled={isCalculatingSize} className="p-1 hover:bg-gray-200 rounded-full disabled:opacity-50">
                                    <RefreshCw size={14} className={isCalculatingSize ? 'animate-spin' : ''} />
                                </button>
                                <span>آخر تحديث: {new Date().toLocaleTimeString('ar-EG')}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-center mt-4 text-sm text-gray-600">
                        <p>
                            هذه الأرقام للمراقبة فقط. لمعرفة الاستخدام الدقيق والتكاليف، يرجى زيارة 
                            <a 
                                href="https://console.firebase.google.com/project/hmza-5dc41/database/hmza-5dc41-default-rtdb/usage" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 font-semibold hover:underline mx-1"
                            >
                                لوحة تحكم Firebase
                                <ExternalLink size={14} className="inline-block mr-1" />
                            </a>
                        </p>
                    </div>
                </div>
            )}

            {isFormDisabled && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6" role="alert">
                    <p className="font-bold">وضع القراءة فقط</p>
                    <p>ليس لديك صلاحية لتغيير هذه الإعدادات.</p>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <InputField label="اسم المدرسة" name="schoolName" value={settings.schoolName} onChange={handleChange} disabled={areNameFieldsDisabled} />
                    <InputField label="اسم مدير المدرسة" name="principalName" value={settings.principalName} onChange={handleChange} disabled={areNameFieldsDisabled} />
                    <InputField label="العام الدراسي" name="academicYear" value={settings.academicYear} onChange={handleChange} placeholder="مثال: 2023-2024" disabled={isFormDisabled}/>
                    <SelectField label="المحافظة" name="governorateName" value={settings.governorateName || ''} onChange={handleChange} options={GOVERNORATES} disabled={isFormDisabled} />
                    <InputField label="المديرية" name="directorate" value={settings.directorate} onChange={handleChange} disabled={isFormDisabled} />
                    <InputField label="القضاء" name="district" value={settings.district || ''} onChange={handleChange} disabled={isFormDisabled} />
                    <InputField label="الناحية" name="subdistrict" value={settings.subdistrict || ''} onChange={handleChange} disabled={isFormDisabled} />
                    <InputField label="رمز المحافظة" name="governorateCode" value={settings.governorateCode || ''} onChange={handleChange} disabled={isFormDisabled} />
                    <InputField label="رمز المدرسة" name="schoolCode" value={settings.schoolCode || ''} onChange={handleChange} disabled={isFormDisabled} />
                    <SelectField label="نوع المدرسة" name="schoolType" value={settings.schoolType || ''} onChange={handleChange} options={SCHOOL_TYPES} disabled={isFormDisabled} />
                    <SelectField label="جنس المدرسة" name="schoolGender" value={settings.schoolGender || ''} onChange={handleChange} options={SCHOOL_GENDERS} disabled={isFormDisabled} />
                    <SelectField label="درجة المدرسة" name="schoolLevel" value={settings.schoolLevel || ''} onChange={handleChange} options={SCHOOL_LEVELS} disabled={areNameFieldsDisabled} />
                    <InputField label="رقم موبايل المدير" name="principalPhone" value={settings.principalPhone || ''} onChange={handleChange} disabled={isFormDisabled} type="tel" />
                    <InputField label="عدد مواد الإكمال" name="supplementarySubjectsCount" type="number" value={settings.supplementarySubjectsCount} onChange={handleChange} disabled={isFormDisabled} />
                    <InputField label="درجة القرار" name="decisionPoints" type="number" value={settings.decisionPoints} onChange={handleChange} disabled={isFormDisabled} />
                </div>
                <div className="flex justify-end pt-6">
                    <button 
                        type="submit" 
                        className="px-8 py-3 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={isFormDisabled}
                    >
                        حفظ الإعدادات
                    </button>
                </div>
            </form>
        </div>
    );
}

// Helper components for form fields
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    name: string;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

const InputField: React.FC<InputFieldProps> = ({ label, name, value, onChange, type = 'text', placeholder, disabled }) => (
    <div>
        <label htmlFor={name} className="block text-md font-medium text-gray-700 mb-2">{label}</label>
        <input
            type={type}
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition disabled:bg-gray-200"
            required
            disabled={disabled}
        />
    </div>
);

interface SelectFieldProps {
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
    disabled?: boolean;
}

const SelectField: React.FC<SelectFieldProps> = ({ label, name, value, onChange, options, disabled }) => (
    <div>
        <label htmlFor={name} className="block text-md font-medium text-gray-700 mb-2">{label}</label>
        <select
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition disabled:bg-gray-200 bg-white"
            required
            disabled={disabled}
        >
            {options.map(option => (
                <option key={option} value={option}>{option}</option>
            ))}
        </select>
    </div>
);