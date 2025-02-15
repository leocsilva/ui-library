export default {
	name: 'description',
	component: 'field-rich-textarea',
	label: 'Journal Description',
	insertPreparedContentLabel: 'Insert',
	skinUrl: '/styles/tinymce',
	value: '',
	plugins: 'paste,link,lists,image,code',
	toolbar:
		'bold italic superscript subscript | link | blockquote bullist numlist | image | code'
};
