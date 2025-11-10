import { Box, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';

export default function ProjectDetail() {
  const { id } = useParams();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Project Detail: {id}
      </Typography>
      <Typography>Project details will be displayed here</Typography>
    </Box>
  );
}
