export const formatDate = (date: Date)=>{
    const formatter = new Date(date).toLocaleDateString("en-US",{
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour:"2-digit",
      minute:"2-digit"
    })
    return formatter
  }